import crypto from 'node:crypto';
import { and, asc, desc, eq } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import Razorpay from 'razorpay';
import { env, isProd } from '../../config/env';
import { db } from '../../db/client';
import { notifications, payments, rechargePacks } from '../../db/schema';
import { hmac, safeEqualHex } from '../../lib/crypto';
import { badRequest, forbidden, notFound } from '../../lib/errors';
import { logger } from '../../lib/logger';
import { getSettings } from '../../lib/settings';
import { refreshSessionLimit } from '../sessions/service';
import { postTxn } from './ledger';

let rzp: Razorpay | null = null;
function razorpay(): Razorpay {
  if (!rzp) rzp = new Razorpay({ key_id: env.RAZORPAY_KEY_ID ?? '', key_secret: env.RAZORPAY_KEY_SECRET ?? '' });
  return rzp;
}

export async function listPacks() {
  const s = await getSettings();
  const rows = await db.select().from(rechargePacks).where(eq(rechargePacks.isActive, true)).orderBy(asc(rechargePacks.sortOrder), asc(rechargePacks.amount));
  return rows.map((p) => ({
    id: p.id,
    amount: p.amount,
    bonusPct: p.bonusPct,
    bonus: Math.floor((p.amount * p.bonusPct) / 100),
    gstAmount: Math.round((p.amount * s.gstPct) / 100),
    isPopular: p.isPopular,
  }));
}

/** Raqam, bonus, GST: sab server tay karta hai. App se aayi raqam par kabhi bharosa nahi. */
export async function createRecharge(userId: string, input: { packId?: string; amount?: number }) {
  const s = await getSettings();
  let amount: number;
  let bonusPct = 0;
  if (input.packId) {
    const [pack] = await db
      .select()
      .from(rechargePacks)
      .where(and(eq(rechargePacks.id, input.packId), eq(rechargePacks.isActive, true)))
      .limit(1);
    if (!pack) throw notFound('Recharge pack');
    amount = pack.amount;
    bonusPct = pack.bonusPct;
  } else if (input.amount !== undefined) {
    amount = input.amount;
    if (amount < s.minRechargePaise || amount > s.maxRechargePaise) {
      throw badRequest('AMOUNT_OUT_OF_RANGE', `Recharge Rs ${s.minRechargePaise / 100} se Rs ${s.maxRechargePaise / 100} ke beech ho`);
    }
  } else {
    throw badRequest('VALIDATION_ERROR', 'packId ya amount dein');
  }
  const bonus = Math.floor((amount * bonusPct) / 100);
  const gstAmount = Math.round((amount * s.gstPct) / 100);
  const totalPayable = amount + gstAmount;
  const id = crypto.randomUUID();

  let providerOrderId: string;
  if (env.PAYMENT_PROVIDER === 'razorpay') {
    const order = await razorpay().orders.create({
      amount: totalPayable,
      currency: 'INR',
      receipt: id,
      notes: { userId, paymentId: id },
    });
    providerOrderId = order.id;
  } else {
    providerOrderId = `mock_order_${id}`;
  }

  await db.insert(payments).values({
    id,
    userId,
    provider: env.PAYMENT_PROVIDER,
    providerOrderId,
    amount,
    bonus,
    gstAmount,
    totalPayable,
  });

  // Checkout page (WebView) ke liye 15 minute ka token: sirf isi payment ke liye kaam karta hai
  const checkoutToken = jwt.sign({ pid: id, uid: userId }, env.JWT_ACCESS_SECRET, {
    expiresIn: '15m',
    audience: 'sunlo-checkout',
    issuer: 'sunlo',
  });

  return {
    paymentId: id,
    provider: env.PAYMENT_PROVIDER,
    providerOrderId,
    amount,
    bonus,
    gstAmount,
    totalPayable,
    currency: 'INR',
    checkoutPath: `/pay/${id}?t=${encodeURIComponent(checkoutToken)}`,
  };
}

export function verifyCheckoutToken(paymentId: string, token: string) {
  try {
    const c = jwt.verify(token, env.JWT_ACCESS_SECRET, {
      audience: 'sunlo-checkout',
      issuer: 'sunlo',
      algorithms: ['HS256'],
    }) as { pid: string; uid: string };
    if (c.pid !== paymentId) throw new Error('mismatch');
    return c;
  } catch {
    throw forbidden('Payment link expire ho gaya. App se dobara koshish karein.');
  }
}

/**
 * Paise wallet mein: sirf ek baar (row lock + PAID check + ledger unique index).
 * Webhook aur app-verify dono ek saath aayein to bhi double credit nahi hoga.
 */
export async function creditPayment(paymentId: string, providerPaymentId: string, paidAmount: number) {
  const result = await creditPaymentTx(paymentId, providerPaymentId, paidAmount);
  if (!result.alreadyCredited) {
    // Chalu session ho to uska samay naye balance ke hisaab se badhao
    await refreshSessionLimit(result.payment.userId).catch((err) => logger.error({ err }, 'refreshSessionLimit failed'));
  }
  return result;
}

async function creditPaymentTx(paymentId: string, providerPaymentId: string, paidAmount: number) {
  return db.transaction(async (tx) => {
    const [p] = await tx.select().from(payments).where(eq(payments.id, paymentId)).for('update').limit(1);
    if (!p) throw notFound('Payment');
    if (p.status === 'PAID') return { alreadyCredited: true, payment: p };
    if (paidAmount !== p.totalPayable) {
      logger.error({ paymentId, paidAmount, expected: p.totalPayable }, 'Payment amount mismatch');
      await tx.update(payments).set({ status: 'FAILED' }).where(eq(payments.id, p.id));
      throw badRequest('AMOUNT_MISMATCH', 'Payment ki raqam mel nahi khati');
    }
    const [updated] = await tx
      .update(payments)
      .set({ status: 'PAID', providerPaymentId, paidAt: new Date() })
      .where(eq(payments.id, p.id))
      .returning();
    await postTxn(tx, { userId: p.userId, type: 'RECHARGE', amount: p.amount, referenceType: 'payment', referenceId: p.id, note: 'Wallet recharge' });
    if (p.bonus > 0) {
      await postTxn(tx, { userId: p.userId, type: 'RECHARGE_BONUS', amount: p.bonus, referenceType: 'payment', referenceId: p.id, note: 'Recharge bonus' });
    }
    await tx.insert(notifications).values({
      userId: p.userId,
      title: 'Recharge safal',
      body: `Rs ${((p.amount + p.bonus) / 100).toFixed(2)} aapke wallet mein jod diye gaye.`,
      data: { type: 'wallet', paymentId: p.id },
    });
    return { alreadyCredited: false, payment: updated };
  });
}

/** App se: Razorpay checkout ke baad. Signature + Razorpay se seedha status check. */
export async function verifyFromApp(
  userId: string,
  input: { paymentId: string; providerPaymentId?: string; signature?: string; mockResult?: 'success' | 'failure' },
) {
  const [p] = await db.select().from(payments).where(eq(payments.id, input.paymentId)).limit(1);
  if (!p || p.userId !== userId) throw notFound('Payment');
  if (p.status === 'PAID') return { status: 'PAID' as const };

  if (p.provider === 'mock') {
    if (isProd || env.PAYMENT_PROVIDER !== 'mock') throw forbidden('Mock payment band hai');
    if (input.mockResult !== 'success') {
      await db.update(payments).set({ status: 'FAILED' }).where(eq(payments.id, p.id));
      return { status: 'FAILED' as const };
    }
    await creditPayment(p.id, `mock_pay_${p.id}`, p.totalPayable);
    return { status: 'PAID' as const };
  }

  if (!input.providerPaymentId || !input.signature) throw badRequest('VALIDATION_ERROR', 'Payment details adhoori hain');
  const expected = hmac(env.RAZORPAY_KEY_SECRET ?? '', `${p.providerOrderId}|${input.providerPaymentId}`);
  if (!/^[0-9a-f]{64}$/.test(input.signature) || !safeEqualHex(expected, input.signature)) {
    throw badRequest('BAD_SIGNATURE', 'Payment verify nahi hua');
  }
  // Signature ke alawa Razorpay se bhi pakka karo ki paisa sach mein aaya
  const rp = await razorpay().payments.fetch(input.providerPaymentId);
  if (rp.order_id !== p.providerOrderId || !['captured', 'authorized'].includes(rp.status)) {
    throw badRequest('PAYMENT_NOT_CAPTURED', 'Payment abhi poora nahi hua');
  }
  await creditPayment(p.id, input.providerPaymentId, Number(rp.amount));
  return { status: 'PAID' as const };
}

/** Razorpay webhook: raw body par HMAC signature check */
export async function handleRazorpayWebhook(rawBody: Buffer, signature: string | undefined) {
  if (env.PAYMENT_PROVIDER !== 'razorpay' || !env.RAZORPAY_WEBHOOK_SECRET) throw notFound('Webhook');
  const expected = hmac(env.RAZORPAY_WEBHOOK_SECRET, rawBody.toString('utf8'));
  if (!signature || !/^[0-9a-f]{64}$/.test(signature) || !safeEqualHex(expected, signature)) {
    throw badRequest('BAD_SIGNATURE', 'Invalid webhook signature');
  }
  const evt = JSON.parse(rawBody.toString('utf8')) as {
    event: string;
    payload?: { payment?: { entity?: { id: string; order_id: string; amount: number; status: string } } };
  };
  const ent = evt.payload?.payment?.entity;
  if (!ent || !['payment.captured', 'order.paid'].includes(evt.event)) return { ignored: true };
  const [p] = await db.select().from(payments).where(eq(payments.providerOrderId, ent.order_id)).limit(1);
  if (!p) return { ignored: true };
  await creditPayment(p.id, ent.id, ent.amount);
  return { ok: true };
}

export async function getPaymentForCheckout(paymentId: string) {
  const [p] = await db.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
  if (!p) throw notFound('Payment');
  return p;
}

export async function paymentHistory(userId: string) {
  return db
    .select({
      id: payments.id,
      amount: payments.amount,
      bonus: payments.bonus,
      gstAmount: payments.gstAmount,
      totalPayable: payments.totalPayable,
      status: payments.status,
      createdAt: payments.createdAt,
    })
    .from(payments)
    .where(eq(payments.userId, userId))
    .orderBy(desc(payments.createdAt))
    .limit(50);
}
