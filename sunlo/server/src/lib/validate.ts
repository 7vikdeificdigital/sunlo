import type { Request } from 'express';
import { z, type ZodTypeAny } from 'zod';
import { badRequest } from './errors';

/** Request ka har input zod se check hota hai; anjaan fields hata di jaati hain */
export function parse<T extends ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  const r = schema.safeParse(data);
  if (!r.success) throw badRequest('VALIDATION_ERROR', 'Di gayi jaankari sahi nahi hai', r.error.flatten());
  return r.data;
}

export const body = <T extends ZodTypeAny>(req: Request, s: T) => parse(s, req.body ?? {});
export const query = <T extends ZodTypeAny>(req: Request, s: T) => parse(s, req.query ?? {});
export const params = <T extends ZodTypeAny>(req: Request, s: T) => parse(s, req.params ?? {});

export const idParam = z.object({ id: z.string().uuid('Galat id') });

export const pagination = z.object({
  page: z.coerce.number().int().min(1).max(1000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+[1-9]\d{7,14}$/, 'Mobile number country code ke saath dein, jaise +919876543210');

export const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date YYYY-MM-DD format mein');
export const timeString = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time HH:mm format mein');
