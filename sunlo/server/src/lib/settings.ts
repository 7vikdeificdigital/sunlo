import { db } from '../db/client';
import { settings } from '../db/schema';

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
