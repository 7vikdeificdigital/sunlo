import type { Request } from 'express';
import { db, type DbOrTx } from '../../db/client';
import { auditLogs } from '../../db/schema';
import { authId } from '../../middleware/auth';

/** Har admin badlav (aur sensitive data dekhna) ka record */
export async function audit(req: Request, action: string, targetType: string, targetId: string | null, meta?: Record<string, unknown>, tx: DbOrTx = db) {
  await tx.insert(auditLogs).values({ adminId: authId(req), action, targetType, targetId, meta: meta ?? null, ip: req.ip ?? null });
}
