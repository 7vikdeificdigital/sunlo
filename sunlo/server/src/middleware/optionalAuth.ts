import type { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from './auth';

/**
 * Public routes (jaise vendor list) par: token ho to user pehchano (blocked vendor chhupane,
 * follow status dikhane ke liye). Token na ho to bhi chalega. Galat token par 401, taaki app refresh kare.
 */
export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return next();
  try {
    req.auth = await verifyAccessToken(h.slice(7));
    next();
  } catch (e) {
    next(e);
  }
}
