import { boolean, check, customType, index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return 'bytea';
  },
});

/** Gift catalog. SVGA animation file DB mein hi rakhi jaati hai (Render restart par nahi jaati) */
export const gifts = pgTable(
  'gifts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    icon: text('icon').notNull().default('🎁'),
    price: integer('price').notNull(), // paise
    svgaData: bytea('svga_data'),
    svgaVersion: integer('svga_version').notNull().default(0),
    mediaType: text('media_type'), // 'svga' | 'webm' (svga_data mein kya rakha hai)
    thumbData: bytea('thumb_data'), // chhota PNG preview (gift sheet ke liye)
    isActive: boolean('is_active').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check('gifts_price_positive', sql`${t.price} > 0`)],
);

/** Bheje gaye gifts ka hisaab (commission us waqt ke % ke saath frozen) */
export const giftSends = pgTable(
  'gift_sends',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: uuid('session_id'), // 1:1 session ka gift; room ka ho to null
    roomId: uuid('room_id'),
    userId: uuid('user_id').notNull(),
    vendorId: uuid('vendor_id').notNull(),
    giftId: uuid('gift_id').notNull(),
    giftName: text('gift_name').notNull(),
    price: integer('price').notNull(),
    commissionPct: integer('commission_pct').notNull(),
    vendorEarning: integer('vendor_earning').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('gift_sends_created_idx').on(t.createdAt), index('gift_sends_session_idx').on(t.sessionId)],
);
