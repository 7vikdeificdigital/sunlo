export type Gender = 'MALE' | 'FEMALE' | 'OTHER';
export type VendorStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';

export interface VendorMe {
  id: string;
  userId: string;
  status: VendorStatus;
  displayName: string;
  headline: string;
  bio: string;
  avatarUrl: string | null;
  gender: Gender | null;
  experienceYears: number;
  languages: string[];
  tags: string[];
  chatRatePerMin: number;
  callRatePerMin: number;
  videoRatePerMin: number;
  chatEnabled: boolean;
  callEnabled: boolean;
  videoEnabled: boolean;
  isOnline: boolean;
  kycDocType: string | null;
  hasKyc: boolean;
  rejectionReason: string | null;
  ratingAvg: number;
  ratingCount: number;
  totalMinutes: number;
  totalSessions: number;
  phone: string;
  categories: { id: string; name: string }[];
  payout: { method: 'UPI'; upiId: string } | { method: 'BANK'; accountHolder: string; accountLast4: string; ifsc: string } | null;
  walletBalance: number;
  limits: { minRatePerMinPaise: number; maxRatePerMinPaise: number; minWithdrawalPaise: number; commissionPct: number };
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  kind: 'LISTENER' | 'EXPERT';
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
  vendorEarning?: number;
  userName?: string;
  intake?: { topic?: string; note?: string } | null;
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

export interface Withdrawal {
  id: string;
  amount: number;
  status: 'PENDING' | 'PAID' | 'REJECTED';
  reference: string | null;
  note: string | null;
  createdAt: string;
  processedAt: string | null;
}

export interface User {
  id: string;
  phone: string | null;
  name: string | null;
  role: 'USER' | 'VENDOR' | 'ADMIN';
}
