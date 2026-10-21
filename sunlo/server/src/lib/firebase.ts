import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { env } from '../config/env';
import { unauthorized, unavailable } from './errors';
import { logger } from './logger';

/**
 * Firebase Phone Auth: OTP bhejna aur check karna Firebase karta hai. Hamara server sirf
 * app se aaya ID token verify karta hai aur usme se VERIFIED phone number nikaalta hai.
 * Service account key sirf server ke .env mein rehti hai (app mein kabhi nahi).
 */
let app: App | undefined;

function firebaseApp(): App {
  if (app) return app;
  const existing = getApps()[0];
  if (existing) return (app = existing);
  const b64 = env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (!b64) throw unavailable('FIREBASE_NOT_CONFIGURED', 'Login service set nahi hai');
  try {
    const json = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
    app = initializeApp({ credential: cert(json) });
  } catch (err) {
    logger.error({ err }, 'FIREBASE_SERVICE_ACCOUNT_BASE64 padhne mein dikkat');
    throw unavailable('FIREBASE_NOT_CONFIGURED', 'Login service set nahi hai');
  }
  return app;
}

/** ID token itna purana nahi hona chahiye (chori hua purana token dobara na chale) */
export const MAX_TOKEN_AGE_SEC = 5 * 60;

/**
 * Firebase ID token verify karo aur verified phone number (E.164, jaise +919876543210) lautao.
 * Sirf "phone" se sign-in kiya hua, taza token chalta hai.
 */
export async function verifyFirebasePhoneToken(idToken: string): Promise<{ phone: string; uid: string }> {
  const fb = firebaseApp(); // set na ho to 503, token galat ho to 401
  let decoded;
  try {
    decoded = await getAuth(fb).verifyIdToken(idToken);
  } catch (err) {
    logger.warn({ code: (err as { code?: string }).code }, 'Firebase token reject hua');
    throw unauthorized('Phone verify nahi ho paya. Dobara koshish karein.');
  }
  if (decoded.firebase?.sign_in_provider !== 'phone' || typeof decoded.phone_number !== 'string') {
    throw unauthorized('Phone verify nahi ho paya. Dobara koshish karein.');
  }
  if (Date.now() / 1000 - decoded.auth_time > MAX_TOKEN_AGE_SEC) {
    throw unauthorized('Verification purani ho gayi. Naya OTP mangayein.');
  }
  return { phone: decoded.phone_number, uid: decoded.uid };
}
