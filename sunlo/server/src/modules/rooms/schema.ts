import { check, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/** Live room: ek host (vendor) audio/video chalata hai, bahut se users sunte/dekhte hain */
export const rooms = pgTable(
  'rooms',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    hostVendorId: uuid('host_vendor_id').notNull(),
    title: text('title').notNull(),
    type: text('type').notNull(), // 'AUDIO' | 'VIDEO'
    ratePerMin: integer('rate_per_min').notNull().default(0), // paise; 0 = free
    commissionPct: integer('commission_pct').notNull(),
    maxListeners: integer('max_listeners').notNull().default(100),
    status: text('status').notNull().default('LIVE'), // 'LIVE' | 'ENDED'
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    totalEarned: integer('total_earned').notNull().default(0),
    peakListeners: integer('peak_listeners').notNull().default(0),
  },
  (t) => [
    check('rooms_type_chk', sql`${t.type} IN ('AUDIO','VIDEO')`),
    uniqueIndex('rooms_one_live_per_host_uq').on(t.hostVendorId).where(sql`status = 'LIVE'`),
    index('rooms_status_idx').on(t.status, t.startedAt),
  ],
);

export const roomMembers = pgTable(
  'room_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    roomId: uuid('room_id').notNull(),
    userId: uuid('user_id').notNull(),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
    leftAt: timestamp('left_at', { withTimezone: true }),
    maxSeconds: integer('max_seconds'), // null = free room
    billedSeconds: integer('billed_seconds').notNull().default(0),
    chargedAmount: integer('charged_amount').notNull().default(0),
    hostEarning: integer('host_earning').notNull().default(0),
    leaveReason: text('leave_reason'),
  },
  (t) => [
    uniqueIndex('room_members_one_open_per_user_uq').on(t.userId).where(sql`left_at IS NULL`),
    index('room_members_room_idx').on(t.roomId, t.leftAt),
  ],
);
