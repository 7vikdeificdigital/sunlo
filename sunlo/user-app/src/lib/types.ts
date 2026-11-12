export type Gender = 'MALE' | 'FEMALE' | 'OTHER';

export interface User {
  id: string;
  phone: string | null;
  email: string | null;
  name: string | null;
  gender: Gender | null;
  avatarUrl: string | null;
  language: string;
  ageConfirmed: boolean;
  role: 'USER' | 'VENDOR' | 'ADMIN';
  referralCode: string;
  profileComplete: boolean;
  dateOfBirth?: string | null;
  consentVersion?: string | null;
  consentAt?: string | null;
  checkinReminder?: boolean;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  kind: 'LISTENER' | 'EXPERT';
}

export interface VendorCard {
  id: string;
  displayName: string;
  headline: string;
  avatarUrl: string | null;
  gender: Gender | null;
  experienceYears: number;
  languages: string[];
  tags: string[];
  categories: { id: string; name: string; kind: 'LISTENER' | 'EXPERT' }[];
  chatRatePerMin: number;
  callRatePerMin: number;
  videoRatePerMin: number;
  chatEnabled: boolean;
  callEnabled: boolean;
  videoEnabled: boolean;
  isOnline: boolean;
  isBusy: boolean;
  ratingAvg: number;
  ratingCount: number;
  totalMinutes: number;
  totalSessions: number;
}

export interface VendorDetail extends VendorCard {
  bio: string;
  isFavorite: boolean;
  isBlocked: boolean;
}

export interface Paged<T> {
  items: T[];
  page: number;
  limit: number;
  total?: number;
}

export type SessionType = 'CHAT' | 'AUDIO' | 'VIDEO';
export type SessionStatus = 'REQUESTED' | 'ACTIVE' | 'COMPLETED' | 'REJECTED' | 'CANCELLED' | 'MISSED';

export interface Session {
  id: string;
  type: SessionType;
  status: SessionStatus;
  userId: string;
  vendorId: string;
  ratePerMin: number;
  maxSeconds: number | null;
  requestedAt: string;
  acceptedAt: string | null;
  endedAt: string | null;
  endReason: string | null;
  billedSeconds: number;
  chargedAmount: number;
  refundedAmount: number;
  freeSeconds?: number;
  promoAmount?: number;
  endsAt: string | null;
  vendor?: { id: string; displayName: string; avatarUrl: string | null };
}

export interface ChatMessage {
  id: string;
  sessionId?: string;
  senderId: string;
  body: string;
  createdAt: string;
  clientId?: string;
  pending?: boolean;
}

export interface WalletTxn {
  id: string;
  type: 'RECHARGE' | 'RECHARGE_BONUS' | 'SESSION_CHARGE' | 'SESSION_EARNING' | 'REFUND' | 'WITHDRAWAL' | 'ADJUSTMENT' | 'TDS' | 'PAYMENT_REFUND';
  amount: number;
  balanceAfter: number;
  note: string | null;
  createdAt: string;
}

export interface RechargePack {
  id: string;
  amount: number;
  bonusPct: number;
  bonus: number;
  gstAmount: number;
  isPopular: boolean;
  playProductId?: string;
}

export interface Helpline {
  name: string;
  phone: string;
  note: string;
}

export interface LiveRoom {
  id: string;
  title: string;
  type: 'AUDIO' | 'VIDEO';
  ratePerMin: number;
  maxListeners: number;
  status: string;
  startedAt: string;
  listeners: number;
  host: { id: string; displayName: string; avatarUrl: string | null; language: string | null };
}

/** Session se pehle keemat (CCPA: saaf keemat) */
export interface Quote {
  vendorId: string;
  type: SessionType;
  ratePerMin: number;
  gstPct: number;
  ratePerMinInclGst: number;
  gstNote: string;
  roundingNote: string;
  minSessionMinutes: number;
  requiredBalance: number;
  balance: number;
  maxMinutes: number;
  freeTrial: { minutes: number; note: string } | null;
}

export interface Receipt {
  receiptNo: string;
  type: SessionType;
  listener: string;
  startedAt: string | null;
  endedAt: string | null;
  durationSeconds: number;
  billedMinutes: number;
  ratePerMin: number;
  grossAmount: number;
  freeMinutes: number;
  freeAmount: number;
  charged: number;
  refunded: number;
  net: number;
  gstNote: string;
  roundingNote: string;
}

export type Mood = { key: string; label: string; icon: string };

export interface Grievance {
  officerName: string;
  email: string;
  phone: string;
  address: string;
  acknowledgeWithinHours: number;
  resolveWithinDays: number;
  unlawfulContentWithinHours: number;
  appealNote: string;
  policyVersion: string;
}

export type ScheduleStatus = 'PENDING' | 'CONFIRMED' | 'DECLINED' | 'CANCELLED' | 'COMPLETED' | 'MISSED';
export interface ScheduledCall {
  id: string;
  vendorId: string;
  type: SessionType;
  scheduledAt: string;
  durationMin: number;
  note: string | null;
  status: ScheduleStatus;
  declineReason: string | null;
  sessionId: string | null;
  canStart: boolean;
  vendor: { id: string; displayName: string; avatarUrl: string | null; isOnline: boolean };
}

export interface CheckinSummary {
  streak: number;
  avg7: number | null;
  suggestion: { kind: 'talk'; text: string; helpline: { name: string; phone: string } } | null;
}
export interface Checkins extends CheckinSummary {
  items: { day: string; mood: number; label: string; note: string | null }[];
  today: string;
  checkedInToday: boolean;
  reminder: boolean;
}
