import { db } from '../db/client';
import { settings } from '../db/schema';
import { HttpError } from './errors';

/**
 * Platform settings. Default yahan hain; Admin panel se badli ja sakti hain (DB mein save).
 * Koi secret/API key yahan kabhi nahi rakhi jaati: woh sirf .env mein.
 */
export const DEFAULT_SETTINGS = {
  appName: 'Bondty',
  currency: 'INR',
  gstPct: 18, // recharge par GST
  giftCommissionPct: 30, // har gift mein platform ka hissa (%)
  commissionPct: 30, // har session mein platform ka hissa (%)
  minSessionMinutes: 5, // session shuru karne ke liye kam se kam itne minute ka balance
  requestTimeoutSec: 60, // vendor itne second mein accept na kare to MISSED
  minRechargePaise: 5000, // Rs 50
  maxRechargePaise: 10_000_000, // Rs 1,00,000
  minRatePerMinPaise: 500, // vendor kam se kam Rs 5/min rakh sakta hai
  maxRatePerMinPaise: 20_000, // zyada se zyada Rs 200/min
  minWithdrawalPaise: 50_000, // Rs 500 se kam ka withdrawal nahi
  supportEmail: 'support@example.com',
  maskContactInfoInChat: true,

  // ---- Grievance Officer (IT Rules 2021/2026: naam aur sampark app + website par dikhana zaroori) ----
  grievanceOfficerName: '',
  grievanceOfficerEmail: '',
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
];

let cache: { at: number; value: Settings } | null = null;
const TTL_MS = 30_000;

export async function getSettings(): Promise<Settings> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
  const rows = await db.select().from(settings);
  const merged: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const r of rows) if (r.key in DEFAULT_SETTINGS) merged[r.key] = r.value;
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
