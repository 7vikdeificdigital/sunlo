import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import express, { Router, type Response } from 'express';
import { z } from 'zod';
import { env } from '../../config/env';
import { db } from '../../db/client';
import { uploads } from '../../db/schema';
import { badRequest, forbidden, notFound } from '../../lib/errors';
import { logger } from '../../lib/logger';
import { body, idParam, params } from '../../lib/validate';
import { authId, requireRole } from '../../middleware/auth';

/**
 * Uploads: profile photo (AVATAR) aur ID document (KYC).
 *  - File ka type uske ASLI bytes (magic bytes) se jaancha jaata hai; naam/mime par bharosa nahi
 *  - Disk par random naam se rakhi jaati hai (asli file naam kabhi use nahi hota)
 *  - AVATAR public hai (GET /files/:id). KYC kabhi public nahi: sirf admin (GET /admin/uploads/:id, audit log ke saath)
 */

type Kind = 'AVATAR' | 'KYC';
type Detected = { mime: string; ext: string };

export const MAX_BYTES: Record<Kind, number> = { AVATAR: 2 * 1024 * 1024, KYC: 5 * 1024 * 1024 };
const IMAGE_ONLY = ['image/png', 'image/jpeg', 'image/webp'];
const ALLOWED: Record<Kind, string[]> = { AVATAR: IMAGE_ONLY, KYC: [...IMAGE_ONLY, 'application/pdf'] };
// base64 text bada hota hai (4/3 guna), isliye JSON body ki seema thodi upar rakhi hai
const JSON_LIMIT = '8mb';
const STORAGE_KEY = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|webp|pdf)$/;

/** Asli bytes dekh kar type batao. Pehchaan na ho to null (reject). */
export function detectType(buf: Buffer): Detected | null {
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { mime: 'image/png', ext: 'png' };
  }
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mime: 'image/jpeg', ext: 'jpg' };
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    return { mime: 'image/webp', ext: 'webp' };
  }
  if (buf.length >= 5 && buf.toString('ascii', 0, 5) === '%PDF-') return { mime: 'application/pdf', ext: 'pdf' };
  return null;
}

const uploadDir = () => path.resolve(env.UPLOAD_DIR);

/** Vendor.avatarUrl mein yahi relative path jaata hai; app use API_URL ke saath jod leti hai */
export const avatarUrl = (id: string) => `/files/${id}`;

export const filesPublic = Router();
export const uploadsRouter = Router();

uploadsRouter.post(
  '/uploads',
  requireRole('USER', 'VENDOR'),
  express.json({ limit: JSON_LIMIT }),
  async (req, res) => {
    const userId = authId(req);
    const input = body(
      req,
      z.object({
        kind: z.enum(['AVATAR', 'KYC']),
        dataBase64: z.string().min(16).max(Math.ceil((MAX_BYTES.KYC * 4) / 3) + 16),
      }),
    );
    // ID document sirf vendor ka hota hai
    if (input.kind === 'KYC' && req.auth?.role !== 'VENDOR') throw forbidden('ID document sirf vendor upload kar sakte hain');

    // "data:image/png;base64," jaisa prefix aaye to hata do
    const b64 = input.dataBase64.replace(/^data:[^,]*;base64,/, '');
    if (!/^[A-Za-z0-9+/\s]+={0,2}\s*$/.test(b64)) throw badRequest('BAD_FILE', 'File sahi nahi hai');
    const buf = Buffer.from(b64, 'base64');
    if (buf.length === 0) throw badRequest('BAD_FILE', 'File khaali hai');
    if (buf.length > MAX_BYTES[input.kind]) {
      throw badRequest('FILE_TOO_LARGE', `File bahut badi hai (max ${MAX_BYTES[input.kind] / 1024 / 1024} MB)`);
    }

    const type = detectType(buf);
    if (!type || !ALLOWED[input.kind].includes(type.mime)) {
      throw badRequest(
        'BAD_FILE_TYPE',
        input.kind === 'AVATAR' ? 'Sirf PNG, JPG ya WEBP photo chalegi' : 'Sirf PNG, JPG, WEBP ya PDF chalega',
      );
    }

    const storageKey = `${randomUUID()}.${type.ext}`;
    await mkdir(uploadDir(), { recursive: true });
    await writeFile(path.join(uploadDir(), storageKey), buf, { mode: 0o600 });
    const [row] = await db
      .insert(uploads)
      .values({ ownerId: userId, kind: input.kind, mime: type.mime, size: buf.length, storageKey })
      .returning();
    res.status(201).json({ id: row!.id, kind: row!.kind, url: row!.kind === 'AVATAR' ? avatarUrl(row!.id) : null });
  },
);

/**
 * File bhejo. KYC tabhi jab allowKyc ho (sirf admin route deta hai). Warna 404:
 * pata hi na chale ki yeh id kisi KYC ki hai.
 */
export async function sendUpload(res: Response, id: string, opts: { allowKyc?: boolean } = {}) {
  const [row] = await db.select().from(uploads).where(eq(uploads.id, id)).limit(1);
  if (!row || (row.kind === 'KYC' && !opts.allowKyc) || !STORAGE_KEY.test(row.storageKey)) throw notFound('File');
  let data: Buffer;
  try {
    data = await readFile(path.join(uploadDir(), row.storageKey));
  } catch (err) {
    logger.error({ err, id }, 'Upload file disk par nahi mili');
    throw notFound('File');
  }
  res.setHeader('Content-Type', row.mime);
  res.setHeader('Content-Length', String(data.length));
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
  res.setHeader('Content-Disposition', 'inline');
  if (row.kind === 'AVATAR') {
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin'); // web app/admin panel doosre domain se dikha sake
  } else {
    res.setHeader('Cache-Control', 'private, no-store');
  }
  res.status(200).end(data);
}

filesPublic.get('/files/:id', async (req, res) => {
  const { id } = params(req, idParam);
  await sendUpload(res, id, { allowKyc: false });
});
