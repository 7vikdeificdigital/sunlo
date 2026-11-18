import { and, eq, isNull } from 'drizzle-orm';
import type { DbOrTx } from '../../db/client';
import { notifications, users, walletTransactions, wallets } from '../../db/schema';
import { getSettings } from '../../lib/settings';
import { postTxn } from './ledger';

export type ReferralGrant = { refereeId: string; refereePaise: number; referrerId: string | null; referrerPaise: number };

/**
 * Referral inaam: jab code lagane wala user apna recharge (kam se kam referralMinRechargePaise, default Rs 100) kar de,
 * tab usko aur code dene wale, dono ko bonus coins. Ek user ke liye sirf ek baar (ledger check se).
 * Recharge ki hi transaction ke andar chalta hai, isliye ya to sab hota hai ya kuch nahi.
 */
export async function grantReferralOnRecharge(tx: DbOrTx, payment: { userId: string; amount: number }): Promise<ReferralGrant | null> {
  const cfg = await getSettings();
  if (!cfg.referralEnabled || payment.amount < cfg.referralMinRechargePaise) return null;

  const [u] = await tx.select({ referredById: users.referredById }).from(users).where(eq(users.id, payment.userId)).limit(1);
  if (!u?.referredById) return null;

  // Pehle hi mil chuka ho to dobara nahi
  const [done] = await tx
    .select({ id: walletTransactions.id })
    .from(walletTransactions)
    .innerJoin(wallets, eq(wallets.id, walletTransactions.walletId))
    .where(and(eq(wallets.userId, payment.userId), eq(walletTransactions.type, 'REFERRAL_BONUS'), eq(walletTransactions.referenceType, 'referral'), eq(walletTransactions.referenceId, payment.userId)))
    .limit(1);
  if (done) return null;

  const refereePaise = cfg.referralBonusPaise;
  const [ref] = await tx
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, u.referredById), eq(users.status, 'ACTIVE'), isNull(users.deletedAt)))
    .limit(1);
  const referrerId = ref?.id ?? null;
  const referrerPaise = referrerId ? cfg.referrerBonusPaise : 0;
  if (refereePaise <= 0 && referrerPaise <= 0) return null;

  if (refereePaise > 0) {
    await postTxn(tx, { userId: payment.userId, type: 'REFERRAL_BONUS', amount: refereePaise, referenceType: 'referral', referenceId: payment.userId, note: 'Referral bonus (pehle recharge par)' });
    await tx.insert(notifications).values({
      userId: payment.userId,
      title: 'Referral bonus mila',
      body: `${Math.round(refereePaise / 100)} coins bonus from referral added to your account`,
      data: { type: 'wallet', kind: 'referral' },
    });
  }
  if (referrerId && referrerPaise > 0) {
    await postTxn(tx, { userId: referrerId, type: 'REFERRAL_BONUS', amount: referrerPaise, referenceType: 'referral_referrer', referenceId: payment.userId, note: 'Referral bonus (dost ne recharge kiya)' });
    await tx.insert(notifications).values({
      userId: referrerId,
      title: 'Referral bonus mila',
      body: `${Math.round(referrerPaise / 100)} coins received from referral`,
      data: { type: 'wallet', kind: 'referral' },
    });
  }
  return { refereeId: payment.userId, refereePaise, referrerId, referrerPaise };
}
