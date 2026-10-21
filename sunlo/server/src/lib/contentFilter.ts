import { db } from '../db/client';
import { blockedKeywords } from '../db/schema';

/**
 * Chat mein phone number / email / blocked shabd chhupana, taaki user aur vendor
 * platform ke bahar deal na karein (purane system ka "defaulter" feature, ab server par).
 */
// 10+ ank (beech mein space/dash/bracket chalega); aakhri ank ke baad ka space nahi khata
const PHONE_RE = /\+?\d(?:[\s\-().]*\d){9,}/g;
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
/** Hamesha lagu; Admin panel se DB mein aur shabd jode ja sakte hain */
const BUILTIN_KEYWORDS = ['whatsapp', 'telegram', 'paytm', 'gpay', 'phonepe', 'upi', 'instagram'];

let kwCache: { at: number; words: string[] } | null = null;

async function keywords(): Promise<string[]> {
  if (kwCache && Date.now() - kwCache.at < 60_000) return kwCache.words;
  const rows = await db.select({ word: blockedKeywords.word }).from(blockedKeywords);
  const words = new Set([...BUILTIN_KEYWORDS, ...rows.map((r) => r.word.toLowerCase().trim())].filter(Boolean));
  kwCache = { at: Date.now(), words: [...words] };
  return kwCache.words;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export async function filterMessage(text: string): Promise<{ body: string; flagged: boolean }> {
  let flagged = false;
  let body = text.replace(PHONE_RE, (m) => {
    flagged = true;
    return '•'.repeat(Math.min(m.length, 10));
  });
  body = body.replace(EMAIL_RE, () => {
    flagged = true;
    return '[email hidden]';
  });
  for (const w of await keywords()) {
    const re = new RegExp(`\\b${escapeRe(w)}\\b`, 'gi');
    if (re.test(body)) {
      flagged = true;
      body = body.replace(re, '***');
    }
  }
  return { body, flagged };
}

export function clearKeywordCache() {
  kwCache = null;
}
