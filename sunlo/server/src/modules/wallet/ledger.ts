import { and, eq, gte, sql } from 'drizzle-orm';
import type { DbOrTx } from '../../db/client';
import { walletTransactions, wallets } from '../../db/schema';
import { HttpError } from '../../lib/errors';

type TxnType = (typeof walletTransactions.$inferInsert)['type'];

export class InsufficientBalanceError extends HttpError {
  constructor() {
    super(402, 'INSUFFICIENT_BALANCE', 'Wallet mein paryapt balance nahi hai');
  }
}

export async function ensureWallet(tx: DbOrTx, userId: string) {
  await tx.insert(wallets).values({ userId }).onConflictDoNothing();
  const [w] = await tx.select().from(wallets).where(eq(wallets.userId, userId)).limit(1);
  return w;
}

/**
 * Wallet mein paise jodne/ghatane ka EKMATRA rasta.
 * - Balance ek hi atomic UPDATE mein badalta hai (do request ek saath aayein to bhi sahi hisaab)
 * - Debit tabhi jab balance kaafi ho; DB ka CHECK constraint bhi negative hone se rokta hai
 * - Har badlav ka ledger entry; (wallet, type, reference) unique hai, isliye double credit/debit sambhav nahi
 * Isse hamesha transaction ke andar bulayein.
 */
export async function postTxn(
  tx: DbOrTx,
  p: { userId: string; type: TxnType; amount: number; referenceType: string; referenceId: string; note?: string },
) {
  if (!Number.isInteger(p.amount) || p.amount === 0) throw new Error('postTxn: amount non-zero integer (paise) hona chahiye');
  const wallet = await ensureWallet(tx, p.userId);
  const cond = p.amount < 0 ? and(eq(wallets.id, wallet.id), gte(wallets.balance, -p.amount)) : eq(wallets.id, wallet.id);
  const [updated] = await tx
    .update(wallets)
    .set({ balance: sql`${wallets.balance} + ${p.amount}` })
    .where(cond)
    .returning({ balance: wallets.balance });
  if (!updated) throw new InsufficientBalanceError();
  const [row] = await tx
    .insert(walletTransactions)
    .values({
      walletId: wallet.id,
      type: p.type,
      amount: p.amount,
      balanceAfter: updated.balance,
      referenceType: p.referenceType,
      referenceId: p.referenceId,
      note: p.note,
    })
    .returning();
  return row;
}
