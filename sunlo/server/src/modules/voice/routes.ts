import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { and, desc, eq, gt, inArray, notInArray, sql } from 'drizzle-orm';
import express, { Router } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '../../config/env';
import { db } from '../../db/client';
import { userBlocks, users, vendors, voiceClips, voiceNotes, voiceReplies } from '../../db/schema';
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors';
import { pushToUser, pushToUsers } from '../../lib/push';
import { body, idParam, params } from '../../lib/validate';
import { authId, requireRole } from '../../middleware/auth';

import { maskName } from '../vendors/routes';

/**
 * Voice-note board:
 *  - USER ek audio note chhodta hai (sirf vendors ko dikhta hai, doosre users ko nahi)
 *  - Koi bhi approved vendor ek baar voice reply de sakta hai
 *  - USER ek vendor chunta hai -> phir normal (paid) chat/call
 */
const MAX_BYTES = 3 * 1024 * 1024;
const MAX_SEC = 90;
const NOTE_TTL_MS = 24 * 3600_000;
const STORAGE_KEY = /^[0-9a-f-]{36}\.(m4a|aac|ogg|webm|mp3|wav|amr)$/;
const uploadDir = () => path.resolve(env.UPLOAD_DIR);

function detectAudio(b: Buffer): { mime: string; ext: string } | null {
  if (b.length < 12) return null;
  if (b.toString('ascii', 4, 8) === 'ftyp') return { mime: 'audio/mp4', ext: 'm4a' };
  if (b[0] === 0xff && (b[1]! & 0xf6) === 0xf0) return { mime: 'audio/aac', ext: 'aac' };
  if (b.toString('ascii', 0, 4) === 'OggS') return { mime: 'audio/ogg', ext: 'ogg' };
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return { mime: 'audio/webm', ext: 'webm' };
  if (b.toString('ascii', 0, 3) === 'ID3' || (b[0] === 0xff && (b[1]! & 0xe0) === 0xe0)) return { mime: 'audio/mpeg', ext: 'mp3' };
  if (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WAVE') return { mime: 'audio/wav', ext: 'wav' };
  if (b.toString('ascii', 0, 5) === '#!AMR') return { mime: 'audio/amr', ext: 'amr' };
  return null;
}

/** Chhote samay ke liye signed link: audio player ko header nahi bhejna padta */
const clipUrl = (id: string) => {
  const t = jwt.sign({ c: id }, env.JWT_ACCESS_SECRET, { expiresIn: '12h', audience: 'sunlo-voice', issuer: 'sunlo' });
  return `/voice/clips/${id}?t=${encodeURIComponent(t)}`;
};

export const voicePublic = Router();
voicePublic.get('/voice/clips/:id', async (req, res) => {
  const { id } = params(req, idParam);
  try {
    const c = jwt.verify(String(req.query.t ?? ''), env.JWT_ACCESS_SECRET, { audience: 'sunlo-voice', issuer: 'sunlo', algorithms: ['HS256'] }) as { c: string };
    if (c.c !== id) throw new Error('mismatch');
  } catch {
    throw forbidden('Link expire ho gaya');
  }
  const [row] = await db.select().from(voiceClips).where(eq(voiceClips.id, id)).limit(1);
  if (!row || !STORAGE_KEY.test(row.storageKey)) throw notFound('Audio');
  let data: Buffer;
  try {
    data = await readFile(path.join(uploadDir(), 'voice', row.storageKey));
  } catch {
    throw notFound('Audio');
  }
  res.setHeader('Content-Type', row.mime);
  res.setHeader('Content-Length', String(data.length));
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, max-age=3600');
  res.status(200).end(data);
});

export const voiceRouter = Router();

// ---- Clip upload (USER aur VENDOR dono) ----
voiceRouter.post('/voice/clips', requireRole('USER', 'VENDOR'), express.json({ limit: '6mb' }), async (req, res) => {
  const userId = authId(req);
  const input = body(req, z.object({ dataBase64: z.string().min(16).max(Math.ceil((MAX_BYTES * 4) / 3) + 16), durationSec: z.number().int().min(1).max(MAX_SEC) }));
  const b64 = input.dataBase64.replace(/^data:[^,]*;base64,/, '');
  if (!/^[A-Za-z0-9+/\s]+={0,2}\s*$/.test(b64)) throw badRequest('BAD_FILE', 'Audio sahi nahi hai');
  const buf = Buffer.from(b64, 'base64');
  if (buf.length > MAX_BYTES) throw badRequest('FILE_TOO_LARGE', 'Audio bahut bada hai (max 3 MB / 90 sec)');
  const type = detectAudio(buf);
  if (!type) throw badRequest('BAD_FILE_TYPE', 'Sirf audio chalega');
  const storageKey = `${randomUUID()}.${type.ext}`;
  await mkdir(path.join(uploadDir(), 'voice'), { recursive: true });
  await writeFile(path.join(uploadDir(), 'voice', storageKey), buf, { mode: 0o600 });
  const [row] = await db.insert(voiceClips).values({ ownerId: userId, mime: type.mime, size: buf.length, durationSec: input.durationSec, storageKey }).returning();
  res.status(201).json({ id: row!.id, durationSec: row!.durationSec });
});

// ---- USER ----
voiceRouter.post('/voice/notes', requireRole('USER'), async (req, res) => {
  const userId = authId(req);
  const { clipId, topic } = body(req, z.object({ clipId: z.string().uuid(), topic: z.string().trim().max(60).optional() }));
  const [clip] = await db.select().from(voiceClips).where(and(eq(voiceClips.id, clipId), eq(voiceClips.ownerId, userId))).limit(1);
  if (!clip) throw notFound('Audio');
  // Purana khula note band; ek time par ek hi
  await db.update(voiceNotes).set({ status: 'CLOSED' }).where(and(eq(voiceNotes.userId, userId), eq(voiceNotes.status, 'OPEN')));
  const [note] = await db.insert(voiceNotes).values({ userId, clipId, topic, expiresAt: new Date(Date.now() + NOTE_TTL_MS) }).returning();
  // Online vendors ko push (baaki jab app kholenge to board mein dekh lenge)
  const online = await db.select({ userId: vendors.userId }).from(vendors).where(and(eq(vendors.status, 'APPROVED'), eq(vendors.isOnline, true))).limit(300);
  
  void pushToUsers(online.map((o) => o.userId), { title: 'Naya voice note', body: 'Ek user ne apni baat voice note mein chhodi hai. Sunkar jawab dein', data: { type: 'voice_note' } });
  res.status(201).json({ id: note!.id, expiresAt: note!.expiresAt });
});

voiceRouter.get('/voice/notes/mine', requireRole('USER'), async (req, res) => {
  const userId = authId(req);
  const [note] = await db.select().from(voiceNotes).where(eq(voiceNotes.userId, userId)).orderBy(desc(voiceNotes.createdAt)).limit(1);
  if (!note) return void res.json({ note: null });
  const [clip] = await db.select().from(voiceClips).where(eq(voiceClips.id, note.clipId)).limit(1);
  const replies = await db
    .select({
      id: voiceReplies.id,
      vendorId: vendors.id,
      displayName: vendors.displayName,
      headline: vendors.headline,
      avatar: vendors.avatarUrl,
      ratingAvg: vendors.ratingAvg,
      isOnline: vendors.isOnline,
      clipId: voiceReplies.clipId,
      createdAt: voiceReplies.createdAt,
    })
    .from(voiceReplies)
    .innerJoin(vendors, eq(vendors.id, voiceReplies.vendorId))
    .where(eq(voiceReplies.noteId, note.id))
    .orderBy(voiceReplies.createdAt);
  const durs = replies.length
    ? await db.select({ id: voiceClips.id, d: voiceClips.durationSec }).from(voiceClips).where(inArray(voiceClips.id, replies.map((r) => r.clipId)))
    : [];
  const dmap = new Map(durs.map((d) => [d.id, d.d]));
  res.json({
    note: {
      id: note.id,
      topic: note.topic,
      status: note.status,
      chosenVendorId: note.chosenVendorId,
      expiresAt: note.expiresAt,
      createdAt: note.createdAt,
      audioUrl: clipUrl(note.clipId),
      durationSec: clip?.durationSec ?? 0,
      replies: replies.map((r) => ({
        id: r.id,
        vendorId: r.vendorId,
        name: r.displayName,
        headline: r.headline,
        avatarUrl: r.avatar ? (r.avatar.startsWith('/files/') ? r.avatar : r.avatar) : null,
        ratingAvg: r.ratingAvg,
        isOnline: r.isOnline,
        audioUrl: clipUrl(r.clipId),
        durationSec: dmap.get(r.clipId) ?? 0,
        createdAt: r.createdAt,
      })),
    },
  });
});

voiceRouter.post('/voice/notes/:id/choose', requireRole('USER'), async (req, res) => {
  const userId = authId(req);
  const { id } = params(req, idParam);
  const { vendorId } = body(req, z.object({ vendorId: z.string().uuid() }));
  const [note] = await db.select().from(voiceNotes).where(and(eq(voiceNotes.id, id), eq(voiceNotes.userId, userId))).limit(1);
  if (!note) throw notFound('Note');
  const [rep] = await db.select().from(voiceReplies).where(and(eq(voiceReplies.noteId, id), eq(voiceReplies.vendorId, vendorId))).limit(1);
  if (!rep) throw badRequest('NOT_REPLIED', 'Is listener ne reply nahi diya');
  await db.update(voiceNotes).set({ status: 'CLOSED', chosenVendorId: vendorId }).where(eq(voiceNotes.id, id));
  const [v] = await db.select({ userId: vendors.userId }).from(vendors).where(eq(vendors.id, vendorId)).limit(1);
  if (v) void pushToUser(v.userId, { title: 'User ne aapko chuna', body: 'Aapke voice reply se user aapse baat karna chahta hai', data: { type: 'voice_chosen' } });
  res.json({ ok: true, vendorId });
});

voiceRouter.post('/voice/notes/:id/close', requireRole('USER'), async (req, res) => {
  const { id } = params(req, idParam);
  await db.update(voiceNotes).set({ status: 'CLOSED' }).where(and(eq(voiceNotes.id, id), eq(voiceNotes.userId, authId(req))));
  res.json({ ok: true });
});

// ---- VENDOR ----
async function myApprovedVendor(userId: string) {
  const [v] = await db.select().from(vendors).where(eq(vendors.userId, userId)).limit(1);
  if (!v || v.status !== 'APPROVED') throw forbidden('Approval ke baad hi voice notes dikhenge');
  return v;
}

voiceRouter.get('/vendor/voice/notes', requireRole('VENDOR'), async (req, res) => {
  const v = await myApprovedVendor(authId(req));
  const blocked = await db.select({ userId: userBlocks.userId }).from(userBlocks).where(eq(userBlocks.vendorId, v.id));
  const rows = await db
    .select({
      id: voiceNotes.id,
      topic: voiceNotes.topic,
      createdAt: voiceNotes.createdAt,
      expiresAt: voiceNotes.expiresAt,
      clipId: voiceNotes.clipId,
      name: users.name,
      replied: sql<boolean>`exists(select 1 from voice_replies r where r.note_id = ${voiceNotes.id} and r.vendor_id = ${v.id})`,
    })
    .from(voiceNotes)
    .innerJoin(users, eq(users.id, voiceNotes.userId))
    .where(and(eq(voiceNotes.status, 'OPEN'), gt(voiceNotes.expiresAt, new Date()), blocked.length ? notInArray(voiceNotes.userId, blocked.map((b) => b.userId)) : undefined))
    .orderBy(desc(voiceNotes.createdAt))
    .limit(50);
  const durs = rows.length ? await db.select({ id: voiceClips.id, d: voiceClips.durationSec }).from(voiceClips).where(inArray(voiceClips.id, rows.map((r) => r.clipId))) : [];
  const dmap = new Map(durs.map((d) => [d.id, d.d]));
  res.json({
    items: rows.map((r) => ({ id: r.id, topic: r.topic, userName: maskName(r.name), createdAt: r.createdAt, expiresAt: r.expiresAt, audioUrl: clipUrl(r.clipId), durationSec: dmap.get(r.clipId) ?? 0, replied: r.replied })),
  });
});

voiceRouter.post('/vendor/voice/notes/:id/reply', requireRole('VENDOR'), async (req, res) => {
  const v = await myApprovedVendor(authId(req));
  const { id } = params(req, idParam);
  const { clipId } = body(req, z.object({ clipId: z.string().uuid() }));
  const [clip] = await db.select().from(voiceClips).where(and(eq(voiceClips.id, clipId), eq(voiceClips.ownerId, v.userId))).limit(1);
  if (!clip) throw notFound('Audio');
  const [note] = await db.select().from(voiceNotes).where(eq(voiceNotes.id, id)).limit(1);
  if (!note || note.status !== 'OPEN' || note.expiresAt <= new Date()) throw conflict('NOTE_CLOSED', 'Ye note ab band ho chuka hai');
  const [blk] = await db.select().from(userBlocks).where(and(eq(userBlocks.userId, note.userId), eq(userBlocks.vendorId, v.id))).limit(1);
  if (blk) throw forbidden('Is user ko reply nahi de sakte');
  const ins = await db.insert(voiceReplies).values({ noteId: id, vendorId: v.id, clipId }).onConflictDoNothing().returning();
  if (!ins.length) throw conflict('ALREADY_REPLIED', 'Aap pehle hi reply de chuke hain');
  void pushToUser(note.userId, { title: 'Listener ka voice reply aaya', body: `${v.displayName || 'Ek listener'} ne aapke note ka jawab diya. Sunkar chunein`, data: { type: 'voice_reply' } });
  res.status(201).json({ ok: true });
});
