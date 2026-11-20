import { db } from '../db/client';
import { settings } from '../db/schema';
import { env } from '../config/env';
import { HttpError } from './errors';

/**
 * Platform settings. Default yahan hain; Admin panel se badli ja sakti hain (DB mein save).
 * Koi secret/API key yahan kabhi nahi rakhi jaati: woh sirf .env mein.
 */
export const DEFAULT_SETTINGS = {
  appName: 'Bondty',
  currency: 'INR',
  gstPct: 18, // recharge par GST
  giftCommissionPct: 50, // har gift mein platform ka hissa (%): listener ko 50%
  commissionPct: 30, // har session mein platform ka hissa (%)
  minSessionMinutes: 5, // session shuru karne ke liye kam se kam itne minute ka balance
  requestTimeoutSec: 60, // vendor itne second mein accept na kare to MISSED
  minRechargePaise: 5000, // Rs 50
  maxRechargePaise: 10_000_000, // Rs 1,00,000
  minRatePerMinPaise: 500, // vendor kam se kam Rs 5/min rakh sakta hai
  maxRatePerMinPaise: 20_000, // zyada se zyada Rs 200/min
  minWithdrawalPaise: 50_000, // Rs 500 se kam ka withdrawal nahi
  supportEmail: 'support@bondty.com',
  maskContactInfoInChat: true,
  lowBalanceWarnSec: 120, // session khatam hone se itne second pehle "recharge karein" alert

  // ---- Grievance Officer (IT Rules 2021/2026: naam aur sampark app + website par dikhana zaroori) ----
  grievanceOfficerName: '',
  grievanceOfficerEmail: 'support@bondty.com',
  grievanceOfficerPhone: '',
  grievanceAddress: '',
  policyVersion: '2026-11', // Terms/Privacy ka version; badalne par users se dobara sahmati
  policyNoticeAuto: true, // har 90 din users ko niyamon ka notice (IT Rules 2026)
  lastPolicyNoticeAt: '' as string, // ISO time

  // ---- Feature switches (Play Store / court ki sakhti ke hisaab se) ----
  liveRoomsEnabled: false, // Live Rooms + room gifts: moderation taiyaar hone tak band
  randomVideoEnabled: false, // Random Connect mein video band; sirf chat/voice
  videoCallsEnabled: true, // chune hue (verified) listener ke saath video call
  giftsEnabled: true, // 1:1 session mein gift

  // ---- Data (DPDP) ----
  chatRetentionDays: 90, // itne din baad chat messages apne aap delete (khuli shikayat wale session chhod kar)

  // ---- TDS (Income-tax Act 2025 Sec 393(1) Table 8(v), purana 194-O) ----
  tdsEnabled: true,
  tdsBps: 10, // 0.1% = 10 basis points (PAN ho to)
  tdsNoPanBps: 500, // 5% (PAN na ho to)

  // ---- Free trial ----
  freeTrialMinutes: 5, // 0 = band
  freeTrialMaxRatePaise: 2000, // sirf Rs 20/min tak ke listener ke saath free trial

  // ---- Referral code (login par) ----
  referralEnabled: true, // band karne par code ka bonus nahi milta
  referralBonusPaise: 5000, // code lagane wale ko Rs 50 = 50 coins (uske pehle recharge par)
  referrerBonusPaise: 5000, // code dene wale ko Rs 50 = 50 coins (dost ke pehle recharge par)
  referralMinRechargePaise: 10000, // bonus ke liye dost ka kam se kam recharge: Rs 100

  // ---- Level (Beginner / Intermediate / Expert): kitne minute baat hui uske hisaab se ----
  levelIntermediateMinutes: 500, // itne minute ke baad Intermediate
  levelExpertMinutes: 1500, // itne minute ke baad Expert
  // Level ka fayda: 1 coin ki keemat (paise mein). Kam keemat = utne hi rupay mein zyada coins.
  // Billing wahi rehti hai (rate per minute coins mein), sirf recharge par coins zyada milte hain.
  coinPaiseBeginner: 80,
  coinPaiseIntermediate: 60,
  coinPaiseExpert: 50,
};

export type Settings = typeof DEFAULT_SETTINGS;
export type SettingKey = keyof Settings;

/** Yeh keys app ko bina login ke dikhayi ja sakti hain */
export const PUBLIC_SETTING_KEYS: SettingKey[] = [
  'appName',
  'currency',
  'gstPct',
  'minSessionMinutes',
  'minRechargePaise',
  'minRatePerMinPaise',
  'maxRatePerMinPaise',
  'minWithdrawalPaise',
  'supportEmail',
  'grievanceOfficerName',
  'grievanceOfficerEmail',
  'grievanceOfficerPhone',
  'grievanceAddress',
  'policyVersion',
  'liveRoomsEnabled',
  'randomVideoEnabled',
  'videoCallsEnabled',
  'giftsEnabled',
  'chatRetentionDays',
  'freeTrialMinutes',
  'freeTrialMaxRatePaise',
  'referralEnabled',
  'referralBonusPaise',
  'referrerBonusPaise',
  'referralMinRechargePaise',
  'lowBalanceWarnSec',
  'levelIntermediateMinutes',
  'levelExpertMinutes',
  'coinPaiseBeginner',
  'coinPaiseIntermediate',
  'coinPaiseExpert',
];

let cache: { at: number; value: Settings } | null = null;
const TTL_MS = 30_000;

export async function getSettings(): Promise<Settings> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
  const rows = await db.select().from(settings);
  const merged: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const r of rows) if (r.key in DEFAULT_SETTINGS) merged[r.key] = r.value;
  // .env GIFTING_ENABLED=false ho to admin panel ki setting kuch bhi ho, gifts band rahenge
  if (!env.GIFTING_ENABLED) merged.giftsEnabled = false;
  cache = { at: Date.now(), value: merged as Settings };
  return cache.value;
}

export function clearSettingsCache() {
  cache = null;
}

/** Feature band ho to saaf error (app purani ho to bhi server rok de) */
export async function requireFeature(key: 'liveRoomsEnabled' | 'randomVideoEnabled' | 'videoCallsEnabled' | 'giftsEnabled') {
  const s = await getSettings();
  if (!s[key]) throw new HttpError(403, 'FEATURE_OFF', 'Yeh suvidha abhi band hai');
}
