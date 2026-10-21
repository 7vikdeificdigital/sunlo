import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import { env } from '../config/env';
import { db } from '../db/client';
import { users } from '../db/schema';
import { forbidden, unauthorized } from '../lib/errors';

export type Role = 'USER' | 'VENDOR' | 'ADMIN';
export interface AuthUser {
  id: string;
  role: Role;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthUser;
    }
  }
}

interface AccessClaims {
  sub: string;
  role: Role;
  tv: number;
}

export function signAccessToken(user: { id: string; role: Role; tokenVersion: number }): string {
  return jwt.sign({ role: user.role, tv: user.tokenVersion }, env.JWT_ACCESS_SECRET, {
    subject: user.id,
    algorithm: 'HS256',
    expiresIn: `${env.ACCESS_TOKEN_TTL_MIN}m`,
    issuer: 'sunlo',
    audience: 'sunlo-api',
  });
}

/**
 * Token check + DB se user ki taaza halat (blocked/deleted/logout-all) check.
 * Isse admin kisi ko block kare to uska access turant band hota hai.
 */
export async function verifyAccessToken(token: string): Promise<AuthUser> {
  let claims: AccessClaims;
  try {
    claims = jwt.verify(token, env.JWT_ACCESS_SECRET, {
      algorithms: ['HS256'],
      issuer: 'sunlo',
      audience: 'sunlo-api',
    }) as unknown as AccessClaims;
  } catch {
    throw unauthorized('Session khatam ho gaya, dobara login karein');
  }
  const [u] = await db
    .select({ id: users.id, role: users.role, status: users.status, tv: users.tokenVersion, deletedAt: users.deletedAt })
    .from(users)
    .where(eq(users.id, claims.sub))
    .limit(1);
  if (!u || u.deletedAt || u.tv !== claims.tv) throw unauthorized('Session khatam ho gaya, dobara login karein');
  if (u.status !== 'ACTIVE') throw forbidden('Aapka account band kar diya gaya hai');
  return { id: u.id, role: u.role };
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return next(unauthorized());
  try {
    req.auth = await verifyAccessToken(h.slice(7));
    next();
  } catch (e) {
    next(e);
  }
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) return next(unauthorized());
    if (!roles.includes(req.auth.role)) return next(forbidden());
    next();
  };
}

/** Route handler ke andar: login user ki id (requireAuth ke baad hamesha maujood) */
export function authId(req: Request): string {
  if (!req.auth) throw unauthorized();
  return req.auth.id;
}
