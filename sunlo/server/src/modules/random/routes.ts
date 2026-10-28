import { Router } from 'express';
import { and, eq, notInArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db/client';
import { vendors, wallets } from '../../db/schema';
import { HttpError } from '../../lib/errors';
import { getSettings } from '../../lib/settings';
import { body } from '../../lib/validate';
import { authId, requireRole } from '../../middleware/auth';
import { requestSession, type SessionType } from '../sessions/service';
import { visibleVendor } from '../vendors/service';

/**
 * Random Connect: user ek button dabata hai (Chat / Voice / Video), server ek online, khaali, user ke
 * balance mein aane wale listener ko random chunkar usse seedha session request bhej deta hai.
 * Billing, accept/reject, call, gifts sab wahi purana session system hai.
 */
export const randomRouter = Router();

const TYPES: SessionType[] = ['CHAT', 'AUDIO', 'VIDEO'];
const enabledCol = { CHAT: vendors.chatEnabled, AUDIO: vendors.callEnabled, VIDEO: vendors.videoEnabled } as const;
const rateCol = { CHAT: vendors.chatRatePerMin, AUDIO: vendors.callRatePerMin, VIDEO: vendors.videoRatePerMin } as const;

/** Online + seva chalu + abhi kisi session ya pending request mein nahi */
const free = sql`not exists(select 1 from consult_sessions cs where cs.vendor_id = ${vendors.id} and cs.status in ('ACTIVE','REQUESTED')) and not exists(select 1 from rooms rm where rm.host_vendor_id = ${vendors.id} and rm.status = 'LIVE')`;

// Har type ke liye: kitne listener abhi free hain + sabse kam rate (Connect screen ke cards ke liye)
randomRouter.get('/random/overview', requireRole('USER'), async (_req, res) => {
  const out: Record<string, { online: number; minRate: number | null }> = {};
  for (const t of TYPES) {
    const [r] = await db
      .select({ n: sql<number>`count(*)::int`, min: sql<number | null>`min(${rateCol[t]})` })
      .from(vendors)
      .where(and(visibleVendor, eq(vendors.isOnline, true), eq(enabledCol[t], true), free));
    out[t] = { online: r?.n ?? 0, minRate: r?.min ?? null };
  }
  // Screen par tairne wale chehre: kuch random free listeners (naam, photo, bhasha, kin cheezon ke liye available)
  const rows = await db
    .select({ id: vendors.id, displayName: vendors.displayName, avatarUrl: vendors.avatarUrl, languages: vendors.languages, chat: vendors.chatEnabled, audio: vendors.callEnabled, video: vendors.videoEnabled })
    .from(vendors)
    .where(and(visibleVendor, eq(vendors.isOnline, true), free))
    .orderBy(sql`random()`)
    .limit(10);
  const people = rows.map((v) => ({
    id: v.id,
    name: v.displayName,
    avatarUrl: v.avatarUrl,
    language: v.languages[0] ?? null,
    types: [v.video && 'VIDEO', v.audio && 'AUDIO', v.chat && 'CHAT'].filter(Boolean) as string[],
  }));
  res.json({ ...out, people });
});

// Ek random listener chunkar usse request bhejta hai. Client "Next" ke liye exclude mein purane vendor ids bhejta hai.
randomRouter.post('/random/connect', requireRole('USER'), async (req, res) => {
  const userId = authId(req);
  const input = body(req, z.object({ type: z.enum(['CHAT', 'AUDIO', 'VIDEO']), exclude: z.array(z.string().uuid()).max(30).default([]) }));
  const type = input.type;
  const st = await getSettings();

  const [w] = await db.select({ balance: wallets.balance }).from(wallets).where(eq(wallets.userId, userId)).limit(1);
  const balance = w?.balance ?? 0;
  const maxRate = Math.floor(balance / st.minSessionMinutes);

  const base = [
    visibleVendor,
    eq(vendors.isOnline, true),
    eq(enabledCol[type], true),
    sql`${vendors.userId} <> ${userId}`,
    free,
    sql`not exists(select 1 from user_blocks ub where ub.user_id = ${userId} and ub.vendor_id = ${vendors.id})`,
    ...(input.exclude.length ? [notInArray(vendors.id, input.exclude)] : []),
  ];

  const candidates = await db
    .select({ id: vendors.id })
    .from(vendors)
    .where(and(...base, sql`${rateCol[type]} <= ${maxRate}`))
    .orderBy(sql`random()`)
    .limit(5);

  if (!candidates.length) {
    // Koi nahi mila: balance ki wajah se ya sach mein koi free nahi
    const [cheapest] = await db
      .select({ min: sql<number | null>`min(${rateCol[type]})` })
      .from(vendors)
      .where(and(...base));
    if (cheapest?.min != null && cheapest.min > maxRate) {
      throw new HttpError(402, 'INSUFFICIENT_BALANCE', `Random connect ke liye kam se kam ${st.minSessionMinutes} minute ka balance chahiye`, {
        required: cheapest.min * st.minSessionMinutes,
        balance,
        shortBy: cheapest.min * st.minSessionMinutes - balance,
      });
    }
    throw new HttpError(409, 'NO_ONE_AVAILABLE', 'Abhi koi listener free nahi hai. Thodi der baad try karein');
  }

  for (const c of candidates) {
    try {
      const session = await requestSession(userId, { vendorId: c.id, type, intake: { topic: 'Random connect' } });
      res.status(201).json({ session });
      return;
    } catch (e) {
      // Beech mein koi busy/offline ho gaya ho to agla try karo; baaki errors (jaise SESSION_ALREADY_OPEN) seedha bahar
      if (e instanceof HttpError && ['VENDOR_BUSY', 'VENDOR_OFFLINE', 'SERVICE_DISABLED', 'NOT_FOUND', 'FORBIDDEN', 'SELF_SESSION'].includes(e.code)) continue;
      throw e;
    }
  }
  throw new HttpError(409, 'NO_ONE_AVAILABLE', 'Abhi koi listener free nahi hai. Thodi der baad try karein');
});
