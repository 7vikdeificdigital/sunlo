import { env, isProd } from '../../config/env';
import { unavailable } from '../../lib/errors';
import { logger } from '../../lib/logger';

/**
 * Development/test ke liye: OTP sirf server ki memory mein (aur dev console mein).
 * Yeh kabhi bhi API response mein nahi jaata. Production mein yeh mode band hai (env.ts).
 */
export const devOtpOutbox = new Map<string, string>();

export async function sendOtpSms(phone: string, code: string): Promise<void> {
  if (env.SMS_PROVIDER === 'console') {
    if (isProd) throw unavailable('SMS_NOT_CONFIGURED', 'SMS service set nahi hai');
    devOtpOutbox.set(phone, code);
    if (env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.log(`\n[DEV ONLY] OTP for ${phone}: ${code}\n`);
    }
    return;
  }

  // MSG91 Flow API: OTP template ke "otp" variable mein jaata hai
  const res = await fetch('https://control.msg91.com/api/v5/flow', {
    method: 'POST',
    headers: { authkey: env.MSG91_AUTH_KEY ?? '', 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      template_id: env.MSG91_TEMPLATE_ID,
      short_url: '0',
      recipients: [{ mobiles: phone.replace(/^\+/, ''), otp: code }],
    }),
    signal: AbortSignal.timeout(10_000),
  }).catch((err) => {
    logger.error({ err }, 'MSG91 request failed');
    return null;
  });
  if (!res || !res.ok) {
    logger.error({ status: res?.status }, 'MSG91 returned error');
    throw unavailable('SMS_FAILED', 'OTP bhejne mein dikkat aayi. Thodi der baad koshish karein.');
  }
}
