import crypto from 'node:crypto';
import { and, desc, eq, gt, isNull, sql } from 'drizzle-orm';
import { env, testLogins } from '../../config/env';
import { db } from '../../db/client';
import { otpCodes, refreshTokens, users, vendors, wallets } from '../../db/schema';
import { hmac, randomOtp, randomReferralCode, randomToken, safeEqualHex, sha256, verifyPassword } from '../../lib/crypto';
import { badRequest, forbidden, notFound, tooMany, unauthorized } from '../../lib/errors';
import { verifyFirebasePhoneToken } from '../../lib/firebase';
import { signAccessToken, type Role } from '../../middleware/auth';
import { sendOtpSms } from './sms';

const OTP_TTL_MS = 5 * 60_000;
const OTP_RESEND_GAP_MS = 30_000;
const OTP_MAX_PER_HOUR = 5;
const OTP_MAX_ATTEMPTS = 5;

const otpHash = (phone: string, code: string) => hmac(env.OTP_PEPPER, `${phone}:${code}`);

export async function requestOtp(phone: string, ip?: string) {
  // Test number: SMS nahi bhejna, rate limit nahi, fixed OTP
  if (testLogins.has(phone)) {
    return { sent: true, expiresInSec: OTP_TTL_MS / 1000, resendAfterSec: 0 };
  }
  const [last] = await db
    .select({ createdAt: otpCodes.createdAt })
    .from(otpCodes)
    .where(eq(otpCodes.phone, phone))
    .orderBy(desc(otpCodes.createdAt))
    .limit(1);
  if (last && Date.now() - last.createdAt.getTime() < OTP_RESEND_GAP_MS) {
    throw tooMany('Naya OTP 30 second baad maang sakte hain');
  }
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(otpCodes)
    .where(and(eq(otpCodes.phone, phone), gt(otpCodes.createdAt, new Date(Date.now() - 3600_000))));
  if (count >= OTP_MAX_PER_HOUR) throw tooMany('Is number par bahut OTP maange gaye. 1 ghante baad koshish karein.');

  const code = randomOtp();
  // Purane bina-use OTP band; sirf naya wala chalega
  await db.update(otpCodes).set({ consumedAt: new Date() }).where(and(eq(otpCodes.phone, phone), isNull(otpCodes.consumedAt)));
  await db.insert(otpCodes).values({ phone, codeHash: otpHash(phone, code), expiresAt: new Date(Date.now() + OTP_TTL_MS), ip });
  await sendOtpSms(phone, code);
  // NOTE: OTP kabhi response mein return nahi hota (purane system ki sabse badi galti yahi thi)
  return { sent: true, expiresInSec: OTP_TTL_MS / 1000, resendAfterSec: OTP_RESEND_GAP_MS / 1000 };
}

async function consumeOtp(phone: string, code: string) {
  const [otp] = await db
    .select()
    .from(otpCodes)
    .where(and(eq(otpCodes.phone, phone), isNull(otpCodes.consumedAt), gt(otpCodes.expiresAt, new Date())))
    .orderBy(desc(otpCodes.createdAt))
    .limit(1);
  if (!otp) throw badRequest('OTP_INVALID', 'OTP galat hai ya expire ho gaya. Naya OTP mangayein.');
  if (otp.attempts >= OTP_MAX_ATTEMPTS) {
    await db.update(otpCodes).set({ consumedAt: new Date() }).where(eq(otpCodes.id, otp.id));
    throw tooMany('Bahut galat koshishein. Naya OTP mangayein.');
  }
  if (!safeEqualHex(otpHash(phone, code), otp.codeHash)) {
    await db.update(otpCodes).set({ attempts: sql`${otpCodes.attempts} + 1` }).where(eq(otpCodes.id, otp.id));
    throw badRequest('OTP_INVALID', 'OTP galat hai');
  }
  // Ek OTP sirf ek baar (do request ek saath aayein to bhi)
  const used = await db
    .update(otpCodes)
    .set({ consumedAt: new Date() })
    .where(and(eq(otpCodes.id, otp.id), isNull(otpCodes.consumedAt)))
    .returning({ id: otpCodes.id });
  if (!used.length) throw badRequest('OTP_INVALID', 'OTP pehle hi use ho chuka hai');
}

type AppKind = 'user' | 'vendor';

/** Server-side OTP sirf AUTH_MODE=otp mein chalta hai; firebase mode mein OTP Firebase sambhalta hai */
export function assertOtpMode() {
  if (env.AUTH_MODE !== 'otp') throw notFound('Yeh login tareeka');
}

export async function verifyOtpAndLogin(input: {
  phone: string;
  code: string;
  app: AppKind;
  referralCode?: string;
  userAgent?: string;
}) {
  const testCode = testLogins.get(input.phone);
  if (testCode !== undefined) {
    if (input.code !== testCode) throw badRequest('OTP_INVALID', 'OTP galat hai');
  } else {
    await consumeOtp(input.phone, input.code);
  }
  return loginWithVerifiedPhone({ phone: input.phone, app: input.app, referralCode: input.referralCode, userAgent: input.userAgent });
}

/** Firebase Phone Auth: app ka ID token verify karke login (user ban jaata hai agar naya ho) */
export async function firebaseLogin(input: { idToken: string; app: AppKind; referralCode?: string; userAgent?: string }) {
  if (env.AUTH_MODE !== 'firebase') throw notFound('Yeh login tareeka');
  const { phone } = await verifyFirebasePhoneToken(input.idToken);
  return loginWithVerifiedPhone({ phone, app: input.app, referralCode: input.referralCode, userAgent: input.userAgent });
}

/** Phone number verify ho chuka hai (OTP ya Firebase se): user dhoondo/banao, role check, tokens do */
async function loginWithVerifiedPhone(input: { phone: string; app: AppKind; referralCode?: string; userAgent?: string }) {
  let [user] = await db.select().from(users).where(eq(users.phone, input.phone)).limit(1);
  let isNewUser = false;

  if (!user) {
    let referredById: string | null = null;
    if (input.referralCode && input.app === 'user') {
      const [ref] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.referralCode, input.referralCode.toUpperCase()))
        .limit(1);
      referredById = ref?.id ?? null;
    }
    const role = input.app === 'vendor' ? ('VENDOR' as const) : ('USER' as const);
    user = await db.transaction(async (tx) => {
      const [u] = await tx
        .insert(users)
        .values({ phone: input.phone, role, referralCode: randomReferralCode(), referredById })
        .returning();
      await tx.insert(wallets).values({ userId: u.id });
      // Vendor ka khaali (DRAFT) profile: vendor app mein bhar kar approval ke liye bhejega
      if (role === 'VENDOR') await tx.insert(vendors).values({ userId: u.id });
      return u;
    });
    isNewUser = true;
  }

  if (user.deletedAt) throw forbidden('Yeh account delete ho chuka hai');
  if (user.status !== 'ACTIVE') throw forbidden('Aapka account band kar diya gaya hai');
  const expectedRole: Role = input.app === 'vendor' ? 'VENDOR' : 'USER';
  if (user.role !== expectedRole) {
    // Ek number ek hi tarah ka account: user aur vendor alag rakhne se paise/hisaab mein gadbad nahi hoti
    throw forbidden(
      input.app === 'vendor'
        ? 'Yeh number User account se juda hai. Vendor ke liye doosra number use karein.'
        : 'Yeh number Vendor account se juda hai. Vendor app use karein.',
    );
  }

  const tokens = await issueTokens(user, input.userAgent);
  return { ...tokens, isNewUser, user: publicUser(user) };
}

export async function adminLogin(email: string, password: string, userAgent?: string) {
  const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
  // User na mile tab bhi utna hi samay lage (timing se email ka pata na chale)
  const dummy = 'scrypt$00000000000000000000000000000000$' + '0'.repeat(128);
  const ok = await verifyPassword(password, user?.passwordHash ?? dummy);
  if (!user || !ok || user.role !== 'ADMIN' || user.status !== 'ACTIVE' || user.deletedAt) {
    throw unauthorized('Email ya password galat hai');
  }
  const tokens = await issueTokens(user, userAgent);
  return { ...tokens, user: publicUser(user) };
}

async function issueTokens(
  user: { id: string; role: Role; tokenVersion: number },
  userAgent?: string,
  familyId: string = crypto.randomUUID(),
) {
  const refreshToken = randomToken();
  await db.insert(refreshTokens).values({
    userId: user.id,
    tokenHash: sha256(refreshToken),
    familyId,
    expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86400_000),
    userAgent: userAgent?.slice(0, 200),
  });
  return { accessToken: signAccessToken(user), refreshToken, accessTokenExpiresInSec: env.ACCESS_TOKEN_TTL_MIN * 60 };
}

/**
 * Refresh token rotation: har refresh par purana token band, naya milta hai.
 * Agar band kiya hua token dobara aaye (chori ka sanket), us login ki poori family band.
 */
export async function refresh(refreshToken: string, userAgent?: string) {
  const [rt] = await db.select().from(refreshTokens).where(eq(refreshTokens.tokenHash, sha256(refreshToken))).limit(1);
  if (!rt) throw unauthorized('Session khatam ho gaya, dobara login karein');
  if (rt.revokedAt) {
    await db.update(refreshTokens).set({ revokedAt: new Date() }).where(and(eq(refreshTokens.familyId, rt.familyId), isNull(refreshTokens.revokedAt)));
    throw unauthorized('Session khatam ho gaya, dobara login karein');
  }
  if (rt.expiresAt < new Date()) throw unauthorized('Session khatam ho gaya, dobara login karein');

  const revoked = await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshTokens.id, rt.id), isNull(refreshTokens.revokedAt)))
    .returning({ id: refreshTokens.id });
  if (!revoked.length) throw unauthorized('Session khatam ho gaya, dobara login karein');

  const [user] = await db.select().from(users).where(eq(users.id, rt.userId)).limit(1);
  if (!user || user.status !== 'ACTIVE' || user.deletedAt) throw unauthorized('Session khatam ho gaya, dobara login karein');
  return issueTokens(user, userAgent, rt.familyId);
}

export async function logout(userId: string, refreshToken?: string) {
  if (!refreshToken) return;
  const [rt] = await db.select().from(refreshTokens).where(eq(refreshTokens.tokenHash, sha256(refreshToken))).limit(1);
  if (rt && rt.userId === userId) {
    await db.update(refreshTokens).set({ revokedAt: new Date() }).where(and(eq(refreshTokens.familyId, rt.familyId), isNull(refreshTokens.revokedAt)));
  }
}

/** Saare devices se logout: token version badhao + saare refresh token band */
export async function logoutAll(userId: string) {
  await db.update(users).set({ tokenVersion: sql`${users.tokenVersion} + 1` }).where(eq(users.id, userId));
  await db.update(refreshTokens).set({ revokedAt: new Date() }).where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)));
}

/** API se bahar jaane wala user object: password hash, token version jaise fields kabhi nahi */
export function publicUser(u: typeof users.$inferSelect) {
  return {
    id: u.id,
    phone: u.phone,
    email: u.email,
    name: u.name,
    gender: u.gender,
    avatarUrl: u.avatarUrl,
    ageConfirmed: Boolean(u.ageConfirmedAt),
    language: u.language,
    role: u.role,
    referralCode: u.referralCode,
    createdAt: u.createdAt,
    profileComplete: Boolean(u.name && u.ageConfirmedAt),
  };
}