import { and, eq, gte, sql } from 'drizzle-orm';
import { db } from '../../db/client';
import { giftSends } from './schema';

/** Gifts ka hisaab dashboard/earnings mein jodne ke liye (paise). Commission = price - vendorEarning */
export async function giftTotals(since: Date) {
  const [r] = await db
    .select({
      count: sql<number>`count(*)::int`,
      gross: sql<number>`coalesce(sum(${giftSends.price}),0)::int`,
      vendorShare: sql<number>`coalesce(sum(${giftSends.vendorEarning}),0)::int`,
    })
    .from(giftSends)
    .where(gte(giftSends.createdAt, since));
  return { count: r?.count ?? 0, gross: r?.gross ?? 0, commission: (r?.gross ?? 0) - (r?.vendorShare ?? 0) };
}

/** Din-wise (IST) gifts: dashboard ke graph ke liye */
export async function giftSeries(since: Date) {
  const day = sql<string>`to_char((${giftSends.createdAt} at time zone 'Asia/Kolkata')::date, 'YYYY-MM-DD')`;
  const rows = await db
    .select({ day, gross: sql<number>`sum(${giftSends.price})::int`, vendor: sql<number>`sum(${giftSends.vendorEarning})::int` })
    .from(giftSends)
    .where(gte(giftSends.createdAt, since))
    .groupBy(sql`1`);
  return rows.map((r) => ({ day: r.day, gross: r.gross, commission: r.gross - r.vendor }));
}

/** Ek vendor ko `since` ke baad gifts se mili kamai (paise) */
export async function giftVendorEarning(vendorId: string, since: Date) {
  const [r] = await db
    .select({ e: sql<number>`coalesce(sum(${giftSends.vendorEarning}),0)::int` })
    .from(giftSends)
    .where(and(eq(giftSends.vendorId, vendorId), gte(giftSends.createdAt, since)));
  return r?.e ?? 0;
}
