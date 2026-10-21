import pino from 'pino';
import { env } from '../config/env';

export const logger = pino({
  level: env.NODE_ENV === 'test' ? 'silent' : 'info',
  // Log mein kabhi bhi token/OTP/password na chhape
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      '*.otp',
      '*.code',
      '*.password',
      '*.refreshToken',
      '*.accessToken',
    ],
    censor: '[hidden]',
  },
});
