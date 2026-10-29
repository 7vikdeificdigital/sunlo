import 'dotenv/config';
import { z } from 'zod';

/**
 * Saari settings sirf environment variables (.env) se aati hain.
 * Code mein koi secret nahi likha jaata. Production mein galat/kamzor setting par
 * server shuru hi nahi hota.
 */
const bool = z
  .string()
  .optional()
  .transform((v) => v === 'true' || v === '1');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL zaroori hai'),
  TRUST_PROXY: bool,
  CORS_ORIGINS: z.string().default(''),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET kam se kam 32 characters ka ho'),
  ACCESS_TOKEN_TTL_MIN: z.coerce.number().int().positive().default(15),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  OTP_PEPPER: z.string().min(32, 'OTP_PEPPER kam se kam 32 characters ka ho'),

  // Login ka tareeka: 'otp' = server khud OTP bhejta hai (MSG91/console), 'firebase' = Firebase Phone Auth (DLT ki zaroorat nahi)
  AUTH_MODE: z.enum(['otp', 'firebase']).default('otp'),
  TEST_LOGINS: z.string().optional(),
  SMS_PROVIDER: z.enum(['console', 'msg91']).default('console'),
  MSG91_AUTH_KEY: z.string().optional(),
  MSG91_TEMPLATE_ID: z.string().optional(),

  PAYMENT_PROVIDER: z.enum(['mock', 'razorpay']).default('mock'),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),

  AGORA_APP_ID: z.string().optional(),
  AGORA_APP_CERTIFICATE: z.string().optional(),

  // Upload files kahan save hon (server ki disk). Production mein S3 jaisa storage lagaya ja sakta hai.
  UPLOAD_DIR: z.string().default('./uploads'),
  // Vendor ke bank account number encrypt karne ki key: 32 bytes, base64 (openssl rand -base64 32)
  PAYOUT_ENC_KEY: z.string().optional(),

  // Firebase service account JSON, base64 mein (sirf server par; app mein kabhi nahi)
  FIREBASE_SERVICE_ACCOUNT_BASE64: z.string().optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('❌ .env mein galti:', parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment configuration');
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';

export const testLogins: Map<string, string> = new Map(
  isProd
    ? []
    : (env.TEST_LOGINS ?? '')
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean)
        .map((x) => x.split(':').map((y) => y.trim()) as [string, string])
        .filter(([phone, code]) => phone && code),
);
// ---- Production safety checks ----
if (isProd) {
  const problems: string[] = [];
  if (env.AUTH_MODE === 'firebase') {
    if (!env.FIREBASE_SERVICE_ACCOUNT_BASE64) problems.push('AUTH_MODE=firebase ke liye FIREBASE_SERVICE_ACCOUNT_BASE64 zaroori hai');
  } else {
    if (env.SMS_PROVIDER === 'console') problems.push('SMS_PROVIDER=console production mein mana hai (OTP log mein chhap jayega)');
    if (env.SMS_PROVIDER === 'msg91' && (!env.MSG91_AUTH_KEY || !env.MSG91_TEMPLATE_ID))
      problems.push('MSG91_AUTH_KEY aur MSG91_TEMPLATE_ID zaroori hain');
  }
  if (env.PAYMENT_PROVIDER === 'mock') problems.push('PAYMENT_PROVIDER=mock production mein mana hai');
  // Webhook secret optional: uske bina bhi payment app se verify hokar credit hoti hai (signature + Razorpay se status check)
  if (env.PAYMENT_PROVIDER === 'razorpay' && (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET))
    problems.push('RAZORPAY_KEY_ID aur RAZORPAY_KEY_SECRET zaroori hain');
  if (!env.PAYOUT_ENC_KEY || Buffer.from(env.PAYOUT_ENC_KEY, 'base64').length !== 32)
    problems.push('PAYOUT_ENC_KEY (32 bytes base64) zaroori hai: openssl rand -base64 32');
  if (!env.CORS_ORIGINS) problems.push('CORS_ORIGINS set karein (admin panel/website ka domain)');
  if (/change[-_]?me|example|secret123|dev_only|test_only/i.test(env.JWT_ACCESS_SECRET + env.OTP_PEPPER))
    problems.push('JWT_ACCESS_SECRET / OTP_PEPPER abhi bhi example value hain; naye random secrets banayein');
  if (problems.length) {
    throw new Error('Production config adhoora hai:\n - ' + problems.join('\n - '));
  }
}
