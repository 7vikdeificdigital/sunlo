import { ApiError } from './api';

/**
 * Web (browser) version: Firebase Phone Auth sirf asli Android/iOS app mein chalta hai
 * (dekhein phoneAuth.native.ts). Browser mein testing ke liye server ko AUTH_MODE=otp par chalayein.
 */
const unsupported = () =>
  new ApiError(0, 'PHONE_AUTH_UNSUPPORTED', 'Phone login web par available nahi hai. Android/iOS app use karein.');

export async function sendPhoneCode(_phone: string, _resend = false): Promise<void> {
  throw unsupported();
}
export async function confirmPhoneCode(_code: string): Promise<string> {
  throw unsupported();
}
export async function finishPhoneAuth(): Promise<void> {}
export function onAutoVerified(_cb: (idToken: string) => void): () => void {
  return () => {};
}
