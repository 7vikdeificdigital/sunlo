import { TurboModuleRegistry } from 'react-native';
import type { ConfirmationResult } from '@react-native-firebase/auth';
import { ApiError } from './api';

/**
 * Firebase Phone Auth (Android/iOS). OTP bhejna aur check karna Firebase karta hai.
 * App sirf ek ID token leti hai aur hamare server ko deti hai (POST /auth/firebase);
 * login ka asli faisla server karta hai. Token milte hi Firebase session hata diya jaata hai.
 *
 * Yeh native module hai: Expo Go mein nahi chalega, development build / EAS build chahiye.
 */
let confirmation: ConfirmationResult | null = null;
let confirming = false; // haath se OTP check chal raha ho to auto-verify listener door rahe

const err = (code: string, message: string) => new ApiError(0, code, message);

type FirebaseAuth = typeof import('@react-native-firebase/auth');

/** Firebase module + auth instance. Native module na ho (Expo Go) to saaf error */
function firebase() {
  const unavailable = () =>
    err('PHONE_AUTH_UNAVAILABLE', 'Phone login ke liye development build chahiye (Expo Go mein nahi chalta).');
  // Pehle check karo ki native module juda hai: Expo Go mein import karte hi error aata hai, jo
  // Metro dev mein try/catch se pakda nahi jaata (poori app gir jaati).
  let linked = false;
  try {
    linked = TurboModuleRegistry.get('NativeRNFBTurboApp') != null;
  } catch {
    linked = false;
  }
  if (!linked) throw unavailable();
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fb = require('@react-native-firebase/auth') as FirebaseAuth;
    return { fb, auth: fb.getAuth() };
  } catch {
    throw unavailable();
  }
}

const MESSAGES: Record<string, string> = {
  'auth/invalid-verification-code': 'OTP galat hai',
  'auth/code-expired': 'OTP expire ho gaya. Naya OTP mangayein.',
  'auth/session-expired': 'OTP expire ho gaya. Naya OTP mangayein.',
  'auth/invalid-phone-number': 'Mobile number sahi nahi hai',
  'auth/too-many-requests': 'Bahut zyada koshishein. Thodi der baad dobara try karein.',
  'auth/quota-exceeded': 'Abhi OTP nahi bhej sakte. Thodi der baad try karein.',
  'auth/network-request-failed': 'Internet connection check karein',
  'auth/user-disabled': 'Yeh number istemaal nahi ho sakta',
  'auth/missing-client-identifier': 'Phone verification abhi set nahi hai. Support se baat karein.',
  'auth/app-not-authorized': 'Phone verification abhi set nahi hai. Support se baat karein.',
  'auth/captcha-check-failed': 'Verification poori nahi hui. Dobara koshish karein.',
  'auth/operation-not-allowed': 'Phone verification abhi set nahi hai. Support se baat karein.',
};

function toApiError(e: unknown): ApiError {
  if (e instanceof ApiError) return e;
  const code = (e as { code?: string } | null)?.code ?? 'auth/unknown';
  return err('PHONE_AUTH', MESSAGES[code] ?? 'OTP mein dikkat aayi. Dobara koshish karein.');
}

export async function sendPhoneCode(phone: string, _resend = false): Promise<void> {
  const { fb, auth } = firebase();
  try {
    // Purana koi Firebase session ho to hata do, taaki kisi aur ka login na ho jaaye
    if (auth.currentUser) await fb.signOut(auth);
    // "Resend" bhi naya signInWithPhoneNumber hi hai (v26 modular API mein forceResend nahi hota)
    confirmation = await fb.signInWithPhoneNumber(auth, phone);
  } catch (e) {
    throw toApiError(e);
  }
}

/** OTP check karke Firebase ID token do. Galat OTP par dobara try kar sakte hain. */
export async function confirmPhoneCode(code: string): Promise<string> {
  if (!confirmation) throw err('PHONE_AUTH_EXPIRED', 'OTP expire ho gaya. Naya OTP mangayein.');
  const { fb, auth } = firebase();
  confirming = true;
  try {
    const cred = await confirmation.confirm(code);
    const user = cred?.user ?? auth.currentUser;
    if (!user) throw err('PHONE_AUTH', 'OTP mein dikkat aayi. Dobara koshish karein.');
    return await fb.getIdToken(user, true);
  } catch (e) {
    throw toApiError(e);
  } finally {
    confirming = false;
  }
}

/** Server se login ho gaya (ya fail): Firebase session hata do, hamare apne tokens hi chalenge */
export async function finishPhoneAuth(): Promise<void> {
  confirmation = null;
  try {
    const { fb, auth } = firebase();
    if (auth.currentUser) await fb.signOut(auth);
  } catch {
    // koi baat nahi
  }
}

/**
 * Android par kabhi SMS padh kar ya instant verification se Firebase khud verify kar deta hai
 * (user ko OTP dalna hi nahi padta). Tab yeh callback ID token ke saath chalta hai.
 */
export function onAutoVerified(cb: (idToken: string) => void): () => void {
  let f: ReturnType<typeof firebase>;
  try {
    f = firebase();
  } catch {
    return () => {};
  }
  return f.fb.onAuthStateChanged(f.auth, async (user) => {
    if (!user?.phoneNumber || confirming) return;
    try {
      cb(await f.fb.getIdToken(user, true));
    } catch {
      // user haath se OTP daal sakta hai
    }
  });
}
