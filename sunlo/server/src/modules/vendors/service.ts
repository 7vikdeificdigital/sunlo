import { and, asc, desc, eq, inArray, sql, type SQL } from 'drizzle-orm';
import { db } from '../../db/client';
import { categories, favorites, userBlocks, vendorCategories, vendors } from '../../db/schema';
import { escapeLike } from '../../lib/sql';

export type Service = 'chat' | 'call' | 'video';

const isBusySql = sql<boolean>`exists(select 1 from consult_sessions cs where cs.vendor_id = ${vendors.id} and cs.status = 'ACTIVE')`;

/** User ko dikhne wali vendor jaankari (KYC, payout, rejection reason jaisi cheezein kabhi nahi) */
export const cardColumns = {
  id: vendors.id,
  displayName: vendors.displayName,
  headline: vendors.headline,
  avatarUrl: vendors.avatarUrl,
  gender: vendors.gender,
  experienceYears: vendors.experienceYears,
  languages: vendors.languages,
  tags: vendors.tags,
  chatRatePerMin: vendors.chatRatePerMin,
  callRatePerMin: vendors.callRatePerMin,
  videoRatePerMin: vendors.videoRatePerMin,
  chatEnabled: vendors.chatEnabled,
  callEnabled: vendors.callEnabled,
  videoEnabled: vendors.videoEnabled,
  isOnline: vendors.isOnline,
  isBusy: isBusySql,
  ratingAvg: vendors.ratingAvg,
  ratingCount: vendors.ratingCount,
  totalMinutes: vendors.totalMinutes,
  totalSessions: vendors.totalSessions,
};

/** Sirf APPROVED + active account wale vendor hi users ko dikhte hain */
export const visibleVendor = and(
  eq(vendors.status, 'APPROVED'),
  sql`exists(select 1 from users u where u.id = ${vendors.userId} and u.status = 'ACTIVE' and u.deleted_at is null)`,
)!;

export async function attachCategories<T extends { id: string }>(rows: T[]) {
  if (!rows.length) return rows.map((r) => ({ ...r, categories: [] as { id: string; name: string; kind: string }[] }));
  const c = await db
    .select({ vendorId: vendorCategories.vendorId, id: categories.id, name: categories.name, kind: categories.kind })
    .from(vendorCategories)
    .innerJoin(categories, eq(categories.id, vendorCategories.categoryId))
    .where(
      inArray(
        vendorCategories.vendorId,
        rows.map((r) => r.id),
      ),
    );
  return rows.map((r) => ({ ...r, categories: c.filter((x) => x.vendorId === r.id).map(({ id, name, kind }) => ({ id, name, kind })) }));
}

export async function listVendors(q: {
  service?: Service;
  search?: string;
  categoryId?: string;
  language?: string;
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
  onlineOnly?: boolean;
  sort: 'recommended' | 'rating' | 'experience' | 'price_low' | 'price_high';
  page: number;
  limit: number;
  viewerId?: string;
}) {
  const conds: SQL[] = [visibleVendor];
  const rateCol = q.service === 'call' ? vendors.callRatePerMin : q.service === 'video' ? vendors.videoRatePerMin : vendors.chatRatePerMin;
  if (q.service === 'chat') conds.push(eq(vendors.chatEnabled, true));
  if (q.service === 'call') conds.push(eq(vendors.callEnabled, true));
  if (q.service === 'video') conds.push(eq(vendors.videoEnabled, true));
  if (q.search) {
    const like = `%${escapeLike(q.search)}%`;
    conds.push(
      sql`(${vendors.displayName} ilike ${like} or ${vendors.headline} ilike ${like} or exists(select 1 from unnest(${vendors.tags}) t where t ilike ${like}))`,
    );
  }
  if (q.onlineOnly) conds.push(eq(vendors.isOnline, true));
  if (q.gender) conds.push(eq(vendors.gender, q.gender));
  if (q.language) conds.push(sql`${q.language} = ANY(${vendors.languages})`);
  if (q.categoryId)
    conds.push(sql`exists(select 1 from vendor_categories x where x.vendor_id = ${vendors.id} and x.category_id = ${q.categoryId})`);
  if (q.viewerId) conds.push(sql`not exists(select 1 from user_blocks b where b.vendor_id = ${vendors.id} and b.user_id = ${q.viewerId})`);

  const order =
    q.sort === 'rating'
      ? [desc(vendors.ratingAvg), desc(vendors.ratingCount)]
      : q.sort === 'experience'
        ? [desc(vendors.experienceYears)]
        : q.sort === 'price_low'
          ? [asc(rateCol)]
          : q.sort === 'price_high'
            ? [desc(rateCol)]
            : [desc(vendors.isOnline), desc(vendors.ratingAvg), desc(vendors.totalMinutes)];

  const where = and(...conds);
  const rows = await db
    .select(cardColumns)
    .from(vendors)
    .where(where)
    .orderBy(...order, asc(vendors.id))
    .limit(q.limit)
    .offset((q.page - 1) * q.limit);
  const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(vendors).where(where);
  return { items: await attachCategories(rows), page: q.page, limit: q.limit, total };
}

export async function getVendor(id: string, viewerId?: string) {
  const [row] = await db
    .select({ ...cardColumns, bio: vendors.bio })
    .from(vendors)
    .where(and(eq(vendors.id, id), visibleVendor))
    .limit(1);
  if (!row) return null;
  const [withCats] = await attachCategories([row]);
  let isFavorite = false;
  let isBlocked = false;
  if (viewerId) {
    const [f] = await db.select({ u: favorites.userId }).from(favorites).where(and(eq(favorites.userId, viewerId), eq(favorites.vendorId, id))).limit(1);
    const [b] = await db.select({ u: userBlocks.userId }).from(userBlocks).where(and(eq(userBlocks.userId, viewerId), eq(userBlocks.vendorId, id))).limit(1);
    isFavorite = !!f;
    isBlocked = !!b;
  }
  return { ...withCats, isFavorite, isBlocked };
}

export async function favoritesList(userId: string) {
  const rows = await db
    .select(cardColumns)
    .from(favorites)
    .innerJoin(vendors, eq(vendors.id, favorites.vendorId))
    .where(and(eq(favorites.userId, userId), visibleVendor))
    .orderBy(desc(favorites.createdAt));
  return attachCategories(rows);
}
