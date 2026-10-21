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
  type: 'RECHARGE' | 'RECHARGE_BONUS' | 'SESSION_CHARGE' | 'SESSION_EARNING' | 'REFUND' | 'WITHDRAWAL' | 'ADJUSTMENT';
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
}

export interface Helpline {
  name: string;
  phone: string;
  note: string;
}
