import crypto from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { GoogleAuth } from 'google-auth-library';
import { env } from '../../config/env';
import { db } from '../../db/client';
import { payments, rechargePacks } from '../../db/schema';
import { badRequest, conflict, forbidden, HttpError, notFound, unavailable } from '../../lib/errors';
import { logger } from '../../lib/logger';
import { creditPayment } from './payments';

/**
 * Google Play Billing: Play Store wali app mein coins Play ke payment se kharide jaate hain.
 * Product ID ka niyam: `coins_<rupaye>` (jaise coins_500 = Rs 500 ka pack). Server pack ko usi raqam se dhoondhta hai,
 * app se aayi raqam par kabhi bharosa nahi. Purchase Google se verify hoti hai, aur ek purchase ek hi baar credit hoti hai.
 */
export type PlayPurchase = { purchaseState: number; orderId: string; obfuscatedExternalAccountId?: string | null; acknowledgementState?: number };
type Verifier = (productId: string, token: string) => Promise<PlayPurchase>;

let auth: GoogleAuth | null = null;
function client() {
  if (!auth) {
    const b64 = env.GOOGLE_PLAY_SERVICE_ACCOUNT_BASE64;
    if (!b64 || !env.GOOGLE_PLAY_PACKAGE_NAME) throw unavailable('PLAY_NOT_CONFIGURED', 'Play Billing set nahi hai');
    auth = new GoogleAuth({ credentials: JSON.parse(Buffer.from(b64, 'base64').toString('utf8')), scopes: ['https://www.googleapis.com/auth/androidpublisher'] });
  }
  return auth;
}
const base = (productId: string, token: string) =>
  `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${env.GOOGLE_PLAY_PACKAGE_NAME}/purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(token)}`;

const googleVerify: Verifier = async (productId, token) => {
  const c = await client().getClient();
  const r = await c.request<PlayPurchase>({ url: base(productId, token) });
  return r.data;
};
let verifier: Verifier = googleVerify;
/** Sirf tests ke liye */
export const setPlayVerifier = (v: Verifier | null) => {
  verifier = v ?? googleVerify;
};

/** Google ko batao ki purchase mil gayi (nahi to 3 din mein Google paisa wapas kar deta hai) */
async function acknowledge(productId: string, token: string) {
  try {
    if (verifier !== googleVerify) return;
    const c = await client().getClient();
    await c.request({ url: `${base(productId, token)}:acknowledge`, method: 'POST', data: {} });
  } catch (err) {
    logger.warn({ err: String(err) }, 'Play acknowledge fail (client consume bhi kar sakta hai)');
  }
}

export async function verifyPlayPurchase(userId: string, input: { productId: string; purchaseToken: string }) {
  const m = /^coins_(\d{1,6})$/.exec(input.productId);
  if (!m) throw badRequest('BAD_PRODUCT', 'Yeh product pehchana nahi gaya');
  const amount = Number(m[1]) * 100;
  const [pack] = await db.select().from(rechargePacks).where(and(eq(rechargePacks.amount, amount), eq(rechargePacks.isActive, true))).limit(1);
  if (!pack) throw notFound('Recharge pack');

  let purchase: PlayPurchase;
  try {
    purchase = await verifier(input.productId, input.purchaseToken);
  } catch (err) {
    if (err instanceof HttpError) throw err;
    logger.warn({ err: String(err) }, 'Play verify fail');
    throw badRequest('PLAY_VERIFY_FAILED', 'Purchase verify nahi ho payi');
  }
  if (purchase.purchaseState === 2) return { status: 'PENDING' as const };
  if (purchase.purchaseState !== 0) throw badRequest('PLAY_NOT_PURCHASED', 'Purchase poori nahi hui');
  // Purchase usi user ki honi chahiye jisne app mein ki (client obfuscatedAccountId = userId set karta hai)
  if (purchase.obfuscatedExternalAccountId && purchase.obfuscatedExternalAccountId !== userId) throw forbidden('Yeh purchase aapke account ki nahi hai');

  const providerOrderId = `play_${purchase.orderId}`;
  const [exist] = await db.select().from(payments).where(eq(payments.providerOrderId, providerOrderId)).limit(1);
  if (exist) {
    if (exist.userId !== userId) throw conflict('PURCHASE_USED', 'Yeh purchase pehle hi use ho chuki hai');
    return { status: exist.status === 'PAID' ? ('PAID' as const) : ('PENDING' as const) };
  }
  const id = crypto.randomUUID();
  const bonus = Math.floor((pack.amount * pack.bonusPct) / 100);
  // Play ki keemat mein tax pehle se judta hai, isliye alag GST nahi: Play price = pack ki raqam
  await db.insert(payments).values({ id, userId, provider: 'play', providerOrderId, amount: pack.amount, bonus, gstAmount: 0, totalPayable: pack.amount });
  await creditPayment(id, purchase.orderId, pack.amount);
  void acknowledge(input.productId, input.purchaseToken);
  return { status: 'PAID' as const, credited: pack.amount + bonus };
}
