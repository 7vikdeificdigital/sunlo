import type { NextFunction, Request, Response } from 'express';
import { HttpError } from '../lib/errors';
import { logger } from '../lib/logger';

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Yeh API maujood nahi hai' } });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
    return;
  }
  // JSON body galat ho
  if (typeof err === 'object' && err && (err as { type?: string }).type === 'entity.parse.failed') {
    res.status(400).json({ error: { code: 'BAD_JSON', message: 'Request body sahi JSON nahi hai' } });
    return;
  }
  if (typeof err === 'object' && err && (err as { type?: string }).type === 'entity.too.large') {
    res.status(413).json({ error: { code: 'TOO_LARGE', message: 'Request bahut badi hai' } });
    return;
  }
  logger.error({ err, path: req.path }, 'Unhandled error');
  // Andar ki galti (stack trace, SQL) kabhi bahar nahi bheji jaati
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Kuch gadbad ho gayi. Thodi der baad koshish karein.' } });
}
