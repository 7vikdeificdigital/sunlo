import { Router } from 'express';
import { z } from 'zod';
import { env } from '../../config/env';
import { authId } from '../../middleware/auth';
import { adminLoginLimiter, authLimiter } from '../../middleware/rateLimit';
import { body, phoneSchema } from '../../lib/validate';
import * as auth from './service';

/** Bina login wale auth routes */
export const authPublic = Router();

/** App ko batata hai ki login kaise karna hai: 'otp' (server OTP) ya 'firebase' (Firebase Phone Auth) */
authPublic.get('/auth/config', (_req, res) => {
  res.json({ mode: env.AUTH_MODE });
});

authPublic.post('/auth/otp/request', authLimiter, async (req, res) => {
  auth.assertOtpMode();
  const { phone } = body(req, z.object({ phone: phoneSchema }));
  res.json(await auth.requestOtp(phone, req.ip));
});

authPublic.post('/auth/otp/verify', authLimiter, async (req, res) => {
  auth.assertOtpMode();
  const input = body(
    req,
    z.object({
      phone: phoneSchema,
      code: z.string().regex(/^\d{6}$/, 'OTP 6 ankon ka hota hai'),
      app: z.enum(['user', 'vendor']),
      referralCode: z.string().trim().max(20).optional(),
    }),
  );
  res.json(await auth.verifyOtpAndLogin({ ...input, userAgent: req.get('user-agent') }));
});

/** Firebase Phone Auth login: app Firebase se OTP verify karke ID token yahan bhejti hai */
authPublic.post('/auth/firebase', authLimiter, async (req, res) => {
  const input = body(
    req,
    z.object({
      idToken: z.string().min(100).max(4096),
      app: z.enum(['user', 'vendor']),
      referralCode: z.string().trim().max(20).optional(),
    }),
  );
  res.json(await auth.firebaseLogin({ ...input, userAgent: req.get('user-agent') }));
});

authPublic.post('/auth/refresh', authLimiter, async (req, res) => {
  const { refreshToken } = body(req, z.object({ refreshToken: z.string().min(20).max(200) }));
  res.json(await auth.refresh(refreshToken, req.get('user-agent')));
});

authPublic.post('/auth/admin/login', adminLoginLimiter, async (req, res) => {
  const { email, password } = body(req, z.object({ email: z.string().email(), password: z.string().min(1).max(200) }));
  res.json(await auth.adminLogin(email, password, req.get('user-agent')));
});

/** Login ke baad wale auth routes */
export const authPrivate = Router();

authPrivate.post('/auth/logout', async (req, res) => {
  const { refreshToken } = body(req, z.object({ refreshToken: z.string().max(200).optional() }));
  await auth.logout(authId(req), refreshToken);
  res.json({ ok: true });
});

authPrivate.post('/auth/logout-all', async (req, res) => {
  await auth.logoutAll(authId(req));
  res.json({ ok: true });
});
