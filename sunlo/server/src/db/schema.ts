/**
 * Sunlo database schema (PostgreSQL, Drizzle ORM)
 *
 * Teen tarah ke log: USER (baat karne wale), VENDOR (listener/expert), ADMIN.
 * Saari raqam PAISE mein integer: Rs 10.50 = 1050. Paise ke liye float kabhi nahi.
 */
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  customType,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

/** Binary data (file ke bytes) Postgres mein */
const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return 'bytea';
  },
});

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

export const roleEnum = pgEnum('role', ['USER', 'VENDOR', 'ADMIN']);
export const accountStatusEnum = pgEnum('account_status', ['ACTIVE', 'BLOCKED']);
export const genderEnum = pgEnum('gender', ['MALE', 'FEMALE', 'OTHER']);
export const vendorStatusEnum = pgEnum('vendor_status', ['DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED']);
export const categoryKindEnum = pgEnum('category_kind', ['LISTENER', 'EXPERT']);
export const txnTypeEnum = pgEnum('txn_type', [
  'RECHARGE',
  'RECHARGE_BONUS',
  'SESSION_CHARGE',
  'SESSION_EARNING',
  'REFUND',
  'WITHDRAWAL',
  'ADJUSTMENT',
  'TDS', // vendor ki kamai se TDS (Income-tax Act 2025 Sec 393, purana 194-O)
  'PAYMENT_REFUND', // recharge ka paisa original payment source par wapas (coins wallet se ghatte hain)
]);
export const paymentStatusEnum = pgEnum('payment_status', ['CREATED', 'PAID', 'FAILED']);
export const sessionTypeEnum = pgEnum('session_type', ['CHAT', 'AUDIO', 'VIDEO']);
export const sessionStatusEnum = pgEnum('session_status', ['REQUESTED', 'ACTIVE', 'COMPLETED', 'REJECTED', 'CANCELLED', 'MISSED']);
export const ticketStatusEnum = pgEnum('ticket_status', ['OPEN', 'CLOSED']);
export const withdrawalStatusEnum = pgEnum('withdrawal_status', ['PENDING', 'PAID', 'REJECTED']);
export const payoutMethodEnum = pgEnum('payout_method', ['UPI', 'BANK']);
export const reportStatusEnum = pgEnum('report_status', ['OPEN', 'RESOLVED']);
export const uploadKindEnum = pgEnum('upload_kind', ['AVATAR', 'KYC']);

// ---------------- Users & auth ----------------

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    phone: text('phone').unique(), // E.164
    email: text('email').unique(),
    passwordHash: text('password_hash'), // sirf ADMIN (scrypt)
    name: text('name'),
    gender: genderEnum('gender'),
    avatarUrl: text('avatar_url'),
    language: text('language').notNull().default('en'),
    ageConfirmedAt: timestamp('age_confirmed_at', { withTimezone: true }), // 18+ ki pushti
    dateOfBirth: date('date_of_birth'), // 18+ ki jaanch janm-tithi se (sirf checkbox kaafi nahi)
    consentVersion: text('consent_version'), // DPDP: kis privacy notice par sahmati di
    consentAt: timestamp('consent_at', { withTimezone: true }),
    totpSecretEnc: text('totp_secret_enc'), // sirf ADMIN: 2FA secret (encrypted)
    totpEnabledAt: timestamp('totp_enabled_at', { withTimezone: true }),
    checkinReminder: boolean('checkin_reminder').notNull().default(false), // roz raat check-in reminder (user ki marzi)
    checkinRemindedOn: date('checkin_reminded_on'),
    role: roleEnum('role').notNull().default('USER'),
    status: accountStatusEnum('status').notNull().default('ACTIVE'),
    tokenVersion: integer('token_version').notNull().default(0),
    referralCode: text('referral_code').notNull().unique(),
    referredById: uuid('referred_by_id'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [index('users_role_status_idx').on(t.role, t.status), index('users_created_idx').on(t.createdAt)],
);

export const otpCodes = pgTable(
  'otp_codes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    phone: text('phone').notNull(),
    codeHash: text('code_hash').notNull(),
    attempts: integer('attempts').notNull().default(0),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    ip: text('ip'),
    createdAt: createdAt(),
  },
  (t) => [index('otp_phone_created_idx').on(t.phone, t.createdAt)],
);

export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    tokenHash: text('token_hash').notNull().unique(),
    familyId: uuid('family_id').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    userAgent: text('user_agent'),
    createdAt: createdAt(),
  },
  (t) => [index('rt_user_idx').on(t.userId), index('rt_family_idx').on(t.familyId)],
);

export const deviceTokens = pgTable('device_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  token: text('token').notNull().unique(),
  platform: text('platform').notNull(),
  updatedAt: updatedAt(),
});

// ---------------- Uploads ----------------

export const uploads = pgTable('uploads', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: uuid('owner_id')
    .notNull()
    .references(() => users.id),
  kind: uploadKindEnum('kind').notNull(),
  mime: text('mime').notNull(),
  size: integer('size').notNull(),
  storageKey: text('storage_key').notNull().unique(), // disk par random naam; asli file naam kabhi use nahi
  data: bytea('data'), // file ke bytes database mein (hosting par disk mit jaati hai). Purani rows mein null = disk par
  createdAt: createdAt(),
});

// ---------------- Categories & vendors ----------------

export const categories = pgTable('categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  slug: text('slug').notNull().unique(),
  description: text('description').notNull().default(''),
  icon: text('icon').notNull().default('chatbubbles-outline'), // Ionicons naam
  kind: categoryKindEnum('kind').notNull().default('EXPERT'),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
});

export const vendors = pgTable(
  'vendors',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .unique()
      .references(() => users.id),
    status: vendorStatusEnum('status').notNull().default('DRAFT'),
    displayName: text('display_name').notNull().default(''),
    headline: text('headline').notNull().default(''), // jaise "Career coach · 8 saal HR"
    bio: text('bio').notNull().default(''),
    avatarUrl: text('avatar_url'),
    gender: genderEnum('gender'),
    experienceYears: integer('experience_years').notNull().default(0),
    languages: text('languages').array().notNull().default(sql`ARRAY[]::text[]`),
    tags: text('tags').array().notNull().default(sql`ARRAY[]::text[]`),
    chatRatePerMin: integer('chat_rate_per_min').notNull().default(1000),
    callRatePerMin: integer('call_rate_per_min').notNull().default(1500),
    videoRatePerMin: integer('video_rate_per_min').notNull().default(2000),
    chatEnabled: boolean('chat_enabled').notNull().default(true),
    callEnabled: boolean('call_enabled').notNull().default(true),
    videoEnabled: boolean('video_enabled').notNull().default(false),
    isOnline: boolean('is_online').notNull().default(false),
    kycDocType: text('kyc_doc_type'),
    kycUploadId: uuid('kyc_upload_id').references(() => uploads.id),
    rejectionReason: text('rejection_reason'),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    ratingAvg: doublePrecision('rating_avg').notNull().default(0),
    ratingCount: integer('rating_count').notNull().default(0),
    totalMinutes: integer('total_minutes').notNull().default(0),
    totalSessions: integer('total_sessions').notNull().default(0),
    favoritesCount: integer('favorites_count').notNull().default(0),
    // PAN: TDS ke liye zaroori. Poora PAN encrypted; dikhaya sirf last 4
    panEnc: text('pan_enc'),
    panLast4: text('pan_last4'),
    panName: text('pan_name'),
    panAddedAt: timestamp('pan_added_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('vendors_status_online_idx').on(t.status, t.isOnline),
    check('vendor_rates_positive', sql`${t.chatRatePerMin} > 0 AND ${t.callRatePerMin} > 0 AND ${t.videoRatePerMin} > 0`),
  ],
);

export const vendorCategories = pgTable(
  'vendor_categories',
  {
    vendorId: uuid('vendor_id')
      .notNull()
      .references(() => vendors.id, { onDelete: 'cascade' }),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.vendorId, t.categoryId] })],
);

export const favorites = pgTable(
  'favorites',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    vendorId: uuid('vendor_id')
      .notNull()
      .references(() => vendors.id),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.vendorId] })],
);

export const userBlocks = pgTable(
  'user_blocks',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    vendorId: uuid('vendor_id')
      .notNull()
      .references(() => vendors.id),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.vendorId] })],
);

/** Vendor ka payout account. Bank account number ENCRYPTED (AES-256-GCM) rehta hai; dikhaya sirf last 4. */
export const payoutAccounts = pgTable('payout_accounts', {
  vendorId: uuid('vendor_id')
    .primaryKey()
    .references(() => vendors.id),
  method: payoutMethodEnum('method').notNull(),
  upiId: text('upi_id'),
  accountHolder: text('account_holder'),
  accountNumberEnc: text('account_number_enc'),
  accountLast4: text('account_last4'),
  ifsc: text('ifsc'),
  updatedAt: updatedAt(),
});

export const withdrawals = pgTable(
  'withdrawals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    vendorId: uuid('vendor_id')
      .notNull()
      .references(() => vendors.id),
    amount: integer('amount').notNull(),
    status: withdrawalStatusEnum('status').notNull().default('PENDING'),
    payoutSnapshot: jsonb('payout_snapshot').notNull(), // request ke waqt ka (masked) account
    reference: text('reference'), // bank UTR / UPI ref
    note: text('note'),
    panLast4: text('pan_last4'),
    processedBy: uuid('processed_by').references(() => users.id),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index('withdrawals_vendor_idx').on(t.vendorId, t.createdAt),
    index('withdrawals_status_idx').on(t.status),
    check('withdrawal_amount_positive', sql`${t.amount} > 0`),
    // Ek vendor ki ek waqt mein ek hi pending request
    uniqueIndex('withdrawal_one_pending_uq').on(t.vendorId).where(sql`status = 'PENDING'`),
  ],
);

// ---------------- Wallet & payments ----------------

export const wallets = pgTable(
  'wallets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .unique()
      .references(() => users.id),
    balance: integer('balance').notNull().default(0),
    updatedAt: updatedAt(),
  },
  (t) => [check('wallet_balance_non_negative', sql`${t.balance} >= 0`)],
);

export const walletTransactions = pgTable(
  'wallet_transactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    walletId: uuid('wallet_id')
      .notNull()
      .references(() => wallets.id),
    type: txnTypeEnum('type').notNull(),
    amount: integer('amount').notNull(),
    balanceAfter: integer('balance_after').notNull(),
    referenceType: text('reference_type').notNull(),
    referenceId: text('reference_id').notNull(),
    note: text('note'),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('wt_idempotency_uq').on(t.walletId, t.type, t.referenceType, t.referenceId),
    index('wt_wallet_created_idx').on(t.walletId, t.createdAt),
  ],
);

export const rechargePacks = pgTable('recharge_packs', {
  id: uuid('id').primaryKey().defaultRandom(),
  amount: integer('amount').notNull(),
  bonusPct: integer('bonus_pct').notNull().default(0),
  isPopular: boolean('is_popular').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const payments = pgTable(
  'payments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    provider: text('provider').notNull(),
    providerOrderId: text('provider_order_id').notNull().unique(),
    providerPaymentId: text('provider_payment_id').unique(),
    amount: integer('amount').notNull(),
    bonus: integer('bonus').notNull().default(0),
    gstAmount: integer('gst_amount').notNull().default(0),
    totalPayable: integer('total_payable').notNull(),
    status: paymentStatusEnum('status').notNull().default('CREATED'),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index('payments_user_created_idx').on(t.userId, t.createdAt), index('payments_status_paid_idx').on(t.status, t.paidAt)],
);

// ---------------- Sessions ----------------

export const consultSessions = pgTable(
  'consult_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    type: sessionTypeEnum('type').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    vendorId: uuid('vendor_id')
      .notNull()
      .references(() => vendors.id),
    ratePerMin: integer('rate_per_min').notNull(),
    commissionPct: integer('commission_pct').notNull(),
    status: sessionStatusEnum('status').notNull().default('REQUESTED'),
    intake: jsonb('intake'), // { topic, note }
    maxSeconds: integer('max_seconds'),
    requestedAt: timestamp('requested_at', { withTimezone: true }).notNull().defaultNow(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    endReason: text('end_reason'),
    billedSeconds: integer('billed_seconds').notNull().default(0),
    chargedAmount: integer('charged_amount').notNull().default(0),
    vendorEarning: integer('vendor_earning').notNull().default(0),
    refundedAmount: integer('refunded_amount').notNull().default(0),
    freeSeconds: integer('free_seconds').notNull().default(0), // free trial ke second (platform deta hai)
    promoAmount: integer('promo_amount').notNull().default(0), // free minute ki keemat jo user ne nahi di
    tdsAmount: integer('tds_amount').notNull().default(0),
    pricingAckAt: timestamp('pricing_ack_at', { withTimezone: true }), // user ne keemat dekh kar haan kaha
    lowBalanceWarnedAt: timestamp('low_balance_warned_at', { withTimezone: true }),
    scheduledCallId: uuid('scheduled_call_id'),
  },
  (t) => [
    index('cs_user_status_idx').on(t.userId, t.status),
    index('cs_vendor_status_idx').on(t.vendorId, t.status),
    index('cs_status_requested_idx').on(t.status, t.requestedAt),
    uniqueIndex('cs_one_open_per_user_uq').on(t.userId).where(sql`status IN ('REQUESTED','ACTIVE')`),
    uniqueIndex('cs_one_active_per_vendor_uq').on(t.vendorId).where(sql`status = 'ACTIVE'`),
  ],
);

export const chatMessages = pgTable(
  'chat_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => consultSessions.id),
    senderId: uuid('sender_id')
      .notNull()
      .references(() => users.id),
    body: text('body').notNull(),
    flagged: boolean('flagged').notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index('cm_session_created_idx').on(t.sessionId, t.createdAt)],
);

export const reviews = pgTable(
  'reviews',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: uuid('session_id')
      .notNull()
      .unique()
      .references(() => consultSessions.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    vendorId: uuid('vendor_id')
      .notNull()
      .references(() => vendors.id),
    rating: integer('rating').notNull(),
    comment: text('comment'),
    reply: text('reply'),
    isHidden: boolean('is_hidden').notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index('reviews_vendor_created_idx').on(t.vendorId, t.createdAt), check('reviews_rating_range', sql`${t.rating} BETWEEN 1 AND 5`)],
);

/** User dwara vendor ki shikayat (galat vyavhar, spam, paise maangna...) */
export const reports = pgTable(
  'reports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    reporterId: uuid('reporter_id')
      .notNull()
      .references(() => users.id),
    vendorId: uuid('vendor_id')
      .notNull()
      .references(() => vendors.id),
    sessionId: uuid('session_id').references(() => consultSessions.id),
    reason: text('reason').notNull(),
    details: text('details'),
    status: reportStatusEnum('status').notNull().default('OPEN'),
    dueAt: timestamp('due_at', { withTimezone: true }), // 36 ghante (IT Rules 2026)
    resolution: text('resolution'),
    resolvedBy: uuid('resolved_by').references(() => users.id),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index('reports_status_idx').on(t.status, t.createdAt)],
);

// ---------------- Content & misc ----------------

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    title: text('title').notNull(),
    body: text('body').notNull(),
    data: jsonb('data'),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index('notif_user_created_idx').on(t.userId, t.createdAt)],
);

export const banners = pgTable('banners', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  subtitle: text('subtitle'),
  link: text('link'),
  isActive: boolean('is_active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const supportTickets = pgTable(
  'support_tickets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    subject: text('subject').notNull(),
    status: ticketStatusEnum('status').notNull().default('OPEN'),
    // GRIEVANCE | GENERAL | PAYMENT | SAFETY | DATA | UNLAWFUL_CONTENT
    category: text('category').notNull().default('GENERAL'),
    acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
    dueAt: timestamp('due_at', { withTimezone: true }), // 7 din; UNLAWFUL_CONTENT 36 ghante
    closedAt: timestamp('closed_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('tickets_user_idx').on(t.userId), index('tickets_status_idx').on(t.status, t.updatedAt), index('tickets_due_idx').on(t.status, t.dueAt)],
);

export const ticketMessages = pgTable('ticket_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  ticketId: uuid('ticket_id')
    .notNull()
    .references(() => supportTickets.id),
  senderId: uuid('sender_id')
    .notNull()
    .references(() => users.id),
  isStaff: boolean('is_staff').notNull().default(false),
  body: text('body').notNull(),
  createdAt: createdAt(),
});

export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: updatedAt(),
});

export const blockedKeywords = pgTable('blocked_keywords', {
  id: uuid('id').primaryKey().defaultRandom(),
  word: text('word').notNull().unique(),
});

/** Admin ne kya kiya, kab, kis par: har badlav ka record (hataya nahi ja sakta API se) */
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    adminId: uuid('admin_id')
      .notNull()
      .references(() => users.id),
    action: text('action').notNull(),
    targetType: text('target_type').notNull(),
    targetId: text('target_id'),
    meta: jsonb('meta'),
    ip: text('ip'),
    createdAt: createdAt(),
  },
  (t) => [index('audit_created_idx').on(t.createdAt)],
);

// ---------------- Voice-note board ----------------
// User raat ko audio note chhode -> vendors sunkar reply (voice) karein -> user ek vendor chune.

export const voiceClips = pgTable('voice_clips', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: uuid('owner_id')
    .notNull()
    .references(() => users.id),
  mime: text('mime').notNull(),
  size: integer('size').notNull(),
  durationSec: integer('duration_sec').notNull(),
  storageKey: text('storage_key').notNull().unique(),
  createdAt: createdAt(),
});

export const voiceNotes = pgTable(
  'voice_notes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    clipId: uuid('clip_id')
      .notNull()
      .references(() => voiceClips.id),
    topic: text('topic'),
    status: text('status').notNull().default('OPEN'), // OPEN | CLOSED
    chosenVendorId: uuid('chosen_vendor_id').references(() => vendors.id),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('voice_notes_open_idx').on(t.status, t.createdAt), index('voice_notes_user_idx').on(t.userId, t.createdAt)],
);

export const voiceReplies = pgTable(
  'voice_replies',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    noteId: uuid('note_id')
      .notNull()
      .references(() => voiceNotes.id, { onDelete: 'cascade' }),
    vendorId: uuid('vendor_id')
      .notNull()
      .references(() => vendors.id),
    clipId: uuid('clip_id')
      .notNull()
      .references(() => voiceClips.id),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('voice_replies_one_per_vendor_uq').on(t.noteId, t.vendorId)],
);

// ---------------- Compliance ----------------

/** Court ya sarkari order par content/account hatana: IT Rules 2026 ke hisaab se 3 ghante */
export const takedowns = pgTable(
  'takedowns',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    targetType: text('target_type').notNull(), // USER | VENDOR | MESSAGE | ROOM | VOICE_NOTE | REVIEW
    targetId: text('target_id').notNull(),
    authority: text('authority').notNull(), // jaise "Delhi High Court", "MeitY", "UP Police (DIG)"
    orderRef: text('order_ref').notNull(),
    note: text('note'),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull(),
    dueAt: timestamp('due_at', { withTimezone: true }).notNull(),
    actionedAt: timestamp('actioned_at', { withTimezone: true }).notNull(),
    actionedBy: uuid('actioned_by')
      .notNull()
      .references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [index('takedowns_created_idx').on(t.createdAt)],
);

// ---------------- Care features ----------------

/** Free trial: ek phone number ek hi baar. Phone ka hash rakhte hain taaki account delete karke dobara na mile */
export const trialClaims = pgTable('trial_claims', {
  phoneHash: text('phone_hash').primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  sessionId: uuid('session_id').notNull(),
  claimedAt: timestamp('claimed_at', { withTimezone: true }).notNull().defaultNow(),
});

/** User apne listener ke saath aage ka time book karta hai; listener confirm karta hai; dono ko reminder */
export const scheduledCalls = pgTable(
  'scheduled_calls',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    vendorId: uuid('vendor_id')
      .notNull()
      .references(() => vendors.id),
    type: sessionTypeEnum('type').notNull(),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),
    durationMin: integer('duration_min').notNull(),
    note: text('note'),
    status: text('status').notNull().default('PENDING'), // PENDING | CONFIRMED | DECLINED | CANCELLED | COMPLETED | MISSED
    declineReason: text('decline_reason'),
    remindedAt: timestamp('reminded_at', { withTimezone: true }),
    sessionId: uuid('session_id'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('sc_vendor_time_idx').on(t.vendorId, t.scheduledAt),
    index('sc_user_time_idx').on(t.userId, t.scheduledAt),
    index('sc_status_time_idx').on(t.status, t.scheduledAt),
  ],
);

/** Roz ka mood (1-5). Note encrypted, kyunki yeh mann ki baat hai */
export const moodCheckins = pgTable(
  'mood_checkins',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    day: date('day').notNull(), // IST din (YYYY-MM-DD)
    mood: integer('mood').notNull(),
    noteEnc: text('note_enc'),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('mood_user_day_uq').on(t.userId, t.day), check('mood_range_chk', sql`${t.mood} BETWEEN 1 AND 5`)],
);
