import { Router } from 'express';
import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db/client';
import { banners, categories, notifications, supportTickets, ticketMessages } from '../../db/schema';
import { conflict, notFound } from '../../lib/errors';
import { getSettings, PUBLIC_SETTING_KEYS } from '../../lib/settings';
import { emitToUser } from '../../lib/realtime';
import { MOODS } from '../care/moods';
import { body, idParam, pagination, params, query } from '../../lib/validate';
import { authId } from '../../middleware/auth';

// ================= Public =================
export const miscPublic = Router();

miscPublic.get('/health', (_req, res) => {
  res.json({ ok: true });
});

/** App shuru hote hi: public settings + categories */
miscPublic.get('/app/config', async (_req, res) => {
  const s = await getSettings();
  const pub = Object.fromEntries(PUBLIC_SETTING_KEYS.map((k) => [k, s[k]]));
  const cats = await db
    .select({ id: categories.id, name: categories.name, slug: categories.slug, description: categories.description, icon: categories.icon, kind: categories.kind })
    .from(categories)
    .where(eq(categories.isActive, true))
    .orderBy(asc(categories.sortOrder), asc(categories.name));
  res.json({
    settings: pub,
    categories: cats,
    languages: ['Hindi', 'English', 'Bengali', 'Gujarati', 'Marathi', 'Tamil', 'Telugu', 'Kannada', 'Malayalam', 'Punjabi', 'Urdu'],
    // Mushkil waqt mein madad: Bharat sarkar ki muft 24x7 mental health helpline
    helplines: [
      { name: 'Tele-MANAS (Bharat Sarkar)', phone: '14416', note: '24x7, muft, kai bhashaon mein' },
      { name: 'Emergency', phone: '112', note: 'Turant khatra ho to' },
    ],
    moods: MOODS.map(({ key, label, icon }) => ({ key, label, icon })),
    grievance: grievanceInfo(s),
  });
});

type S = Awaited<ReturnType<typeof getSettings>>;
/** IT Rules: Grievance Officer ka naam/sampark + shikayat ka samay (app aur website par dikhana zaroori) */
function grievanceInfo(s: S) {
  return {
    officerName: s.grievanceOfficerName,
    email: s.grievanceOfficerEmail || s.supportEmail,
    phone: s.grievanceOfficerPhone,
    address: s.grievanceAddress,
    acknowledgeWithinHours: 24,
    resolveWithinDays: 7,
    unlawfulContentWithinHours: 36,
    appealNote: 'Jawab se santusht na hon to Grievance Appellate Committee (gac.gov.in) mein 30 din ke andar appeal kar sakte hain.',
    policyVersion: s.policyVersion,
  };
}

/** Website / app ka "Grievance Officer" page (bina login) */
miscPublic.get('/grievance', async (_req, res) => {
  res.json(grievanceInfo(await getSettings()));
});

miscPublic.get('/banners', async (_req, res) => {
  res.json({ items: await db.select().from(banners).where(eq(banners.isActive, true)).orderBy(asc(banners.sortOrder)) });
});

miscPublic.get('/support/faqs', (_req, res) => {
  res.json({
    items: [
      { q: 'Wallet mein paise kaise daalein?', a: 'Wallet screen par koi pack chunein ya raqam likhein, phir payment karein. Payment safal hote hi paise wallet mein dikh jayenge.' },
      { q: 'Chat/Call ka paisa kaise katta hai?', a: 'Har listener/expert ka per-minute rate profile par likha hai. Har shuru hue minute ka utna paisa katta hai. Session tabhi shuru hota hai jab wallet mein kam se kam 5 minute ka balance ho.' },
      { q: 'Kya meri baat-cheet private hai?', a: 'Haan. Aapki chat sirf aapko aur us vendor ko dikhti hai. Phone number ya email chat mein apne aap chhup jaate hain. Vendor ko sirf aapka pehla naam dikhta hai.' },
      { q: 'Listener aur Expert mein kya fark hai?', a: 'Listener aapki baat dhyan se sunte hain aur saath dete hain; woh doctor ya therapist nahi hain. Expert kisi field (career, legal, finance...) mein salah dete hain.' },
      { q: 'Kisi ka vyavhar galat laga to?', a: 'Profile ya session par "Report" dabayein. Hamari team 24 ghante mein jaanch karti hai, aur zaroorat ho to paisa wapas kiya jaata hai.' },
    ],
  });
});

// ================= Login zaroori =================
export const miscPrivate = Router();

miscPrivate.get('/notifications', async (req, res) => {
  const userId = authId(req);
  const { page, limit } = query(req, pagination);
  const items = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit)
    .offset((page - 1) * limit);
  const [{ unread }] = await db
    .select({ unread: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  res.json({ items, unread, page, limit });
});

miscPrivate.post('/notifications/read', async (req, res) => {
  const userId = authId(req);
  const { ids } = body(req, z.object({ ids: z.array(z.string().uuid()).max(100).optional() }));
  const cond = ids?.length
    ? and(eq(notifications.userId, userId), inArray(notifications.id, ids))
    : eq(notifications.userId, userId);
  await db.update(notifications).set({ readAt: new Date() }).where(and(cond, isNull(notifications.readAt)));
  res.json({ ok: true });
});

miscPrivate.get('/support/tickets', async (req, res) => {
  const items = await db.select().from(supportTickets).where(eq(supportTickets.userId, authId(req))).orderBy(desc(supportTickets.updatedAt));
  res.json({ items: items.map((t) => ({ ...t, ticketNo: ticketNo(t.id) })) });
});

export const TICKET_CATEGORIES = ['GENERAL', 'PAYMENT', 'SAFETY', 'DATA', 'GRIEVANCE', 'UNLAWFUL_CONTENT'] as const;
/** IT Rules 2026: aam shikayat 7 din, ghair-kanooni content wali 36 ghante */
export const ticketDueAt = (category: string, from = new Date()) =>
  new Date(from.getTime() + (category === 'UNLAWFUL_CONTENT' ? 36 * 3600_000 : 7 * 86400_000));
export const ticketNo = (id: string) => `GR-${id.slice(0, 8).toUpperCase()}`;

miscPrivate.post('/support/tickets', async (req, res) => {
  const userId = authId(req);
  const { subject, message, category } = body(
    req,
    z.object({
      subject: z.string().trim().min(3).max(120),
      message: z.string().trim().min(1).max(2000),
      category: z.enum(TICKET_CATEGORIES).default('GENERAL'),
    }),
  );
  const now = new Date();
  const t = await db.transaction(async (tx) => {
    // Shikayat milte hi pavti (acknowledgement): ticket number + kab tak jawab
    const [ticket] = await tx
      .insert(supportTickets)
      .values({ userId, subject, category, acknowledgedAt: now, dueAt: ticketDueAt(category, now) })
      .returning();
    await tx.insert(ticketMessages).values({ ticketId: ticket.id, senderId: userId, body: message });
    return ticket;
  });
  const due = t.dueAt!.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });
  const title = 'Aapki shikayat mil gayi';
  const ack = `Ticket ${ticketNo(t.id)} darj ho gaya. Hum ${due} tak samadhan karenge.`;
  await db.insert(notifications).values({ userId, title, body: ack, data: { type: 'ticket', ticketId: t.id } });
  emitToUser(userId, 'notification', { title, body: ack, data: { type: 'ticket', ticketId: t.id } });
  res.status(201).json({ ...t, ticketNo: ticketNo(t.id), acknowledgement: ack });
});

async function ownTicket(userId: string, id: string) {
  const [t] = await db
    .select()
    .from(supportTickets)
    .where(and(eq(supportTickets.id, id), eq(supportTickets.userId, userId)))
    .limit(1);
  if (!t) throw notFound('Ticket');
  return t;
}

miscPrivate.get('/support/tickets/:id', async (req, res) => {
  const userId = authId(req);
  const { id } = params(req, idParam);
  const t = await ownTicket(userId, id);
  const messages = await db
    .select({ id: ticketMessages.id, body: ticketMessages.body, isStaff: ticketMessages.isStaff, createdAt: ticketMessages.createdAt })
    .from(ticketMessages)
    .where(eq(ticketMessages.ticketId, id))
    .orderBy(asc(ticketMessages.createdAt));
  res.json({ ...t, ticketNo: ticketNo(t.id), messages });
});

miscPrivate.post('/support/tickets/:id/messages', async (req, res) => {
  const userId = authId(req);
  const { id } = params(req, idParam);
  const t = await ownTicket(userId, id);
  if (t.status === 'CLOSED') throw conflict('TICKET_CLOSED', 'Yeh ticket band ho chuka hai');
  const { message } = body(req, z.object({ message: z.string().trim().min(1).max(2000) }));
  const [m] = await db.insert(ticketMessages).values({ ticketId: id, senderId: userId, body: message }).returning();
  await db.update(supportTickets).set({ updatedAt: new Date() }).where(eq(supportTickets.id, id));
  res.status(201).json(m);
});
