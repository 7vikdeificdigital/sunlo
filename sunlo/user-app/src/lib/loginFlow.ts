import { api, ApiError } from './api';
import * as phoneAuth from './phoneAuth';

/**
 * Login ke do tareeke; server batata hai kaun sa chalega (GET /auth/config):
 *  - 'firebase': OTP Firebase bhejta hai, app ID token server ko deti hai (POST /auth/firebase)
 *  - 'otp'     : server khud OTP bhejta hai (POST /auth/otp/request, /auth/otp/verify)
 * Screens ko farak nahi padta; woh sirf yeh functions bulate hain.
 */
export type AuthMode = 'otp' | 'firebase';
export type LoginTokens = { accessToken: string; refreshToken: string };

const APP_KIND = 'user' as const;
let cachedMode: AuthMode | undefined;

export async function getAuthMode(): Promise<AuthMode> {
  if (cachedMode) return cachedMode;
  try {
    const r = await api<{ mode: AuthMode }>('/auth/config', { auth: false });
    return (cachedMode = r.mode === 'firebase' ? 'firebase' : 'otp');
  } catch (e) {
    // Purana server jisme /auth/config nahi hai: seedha OTP mode
    if (e instanceof ApiError && e.status === 404) return (cachedMode = 'otp');
    throw e;
  }
}

export async function sendLoginCode(phone: string, opts: { resend?: boolean } = {}): Promise<void> {
  if ((await getAuthMode()) === 'firebase') return phoneAuth.sendPhoneCode(phone, opts.resend);
  await api('/auth/otp/request', { method: 'POST', auth: false, body: { phone } });
}

const exchange = (idToken: string) =>
  api<LoginTokens>('/auth/firebase', { method: 'POST', auth: false, body: { idToken, app: APP_KIND } });

let exchanging = false; // haath se OTP aur auto-verify ek saath ho to ek hi baar login

export async function verifyLoginCode(phone: string, code: string): Promise<LoginTokens> {
  if ((await getAuthMode()) !== 'firebase') {
    return api<LoginTokens>('/auth/otp/verify', { method: 'POST', auth: false, body: { phone, code, app: APP_KIND } });
  }
  const idToken = await phoneAuth.confirmPhoneCode(code);
  exchanging = true;
  try {
    return await exchange(idToken);
  } finally {
    exchanging = false;
    await phoneAuth.finishPhoneAuth();
  }
}

/**
 * Android auto-verify: user ke OTP dale bina Firebase verify kar de to seedha login.
 * Sirf firebase mode mein chalta hai; otp mode mein Firebase ko chhua hi nahi jaata.
 */
export function watchAutoVerify(onTokens: (t: LoginTokens) => void): () => void {
  let stop: (() => void) | undefined;
  let cancelled = false;
  getAuthMode()
    .then((mode) => {
      if (mode !== 'firebase' || cancelled) return;
      stop = phoneAuth.onAutoVerified(async (idToken) => {
        if (exchanging) return;
        exchanging = true;
        try {
          onTokens(await exchange(idToken));
        } catch {
          // user haath se OTP daal sakta hai
        } finally {
          exchanging = false;
          await phoneAuth.finishPhoneAuth();
        }
      });
    })
    .catch(() => undefined);
  return () => {
    cancelled = true;
    stop?.();
  };
}
