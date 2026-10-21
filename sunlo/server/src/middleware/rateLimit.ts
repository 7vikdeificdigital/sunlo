import rateLimit from 'express-rate-limit';
import { isTest } from '../config/env';

const common = {
  standardHeaders: 'draft-7' as const,
  legacyHeaders: false,
  skip: () => isTest,
  message: { error: { code: 'TOO_MANY_REQUESTS', message: 'Bahut zyada requests. Thodi der baad koshish karein.' } },
};

/** Saari API par aam seema */
export const apiLimiter = rateLimit({ ...common, windowMs: 60_000, limit: 300 });
/** OTP / login par sakht seema (IP ke hisaab se). Phone ke hisaab se seema service mein alag hai. */
export const authLimiter = rateLimit({ ...common, windowMs: 15 * 60_000, limit: 20 });
export const adminLoginLimiter = rateLimit({ ...common, windowMs: 15 * 60_000, limit: 10 });
