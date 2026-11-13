import { Alert } from 'react-native';
import { create } from 'zustand';
import { DICT } from './dict';
import { EXTRA } from './dictExtra';
import { secureStorage } from './storage';

/** hinglish = jaisa app pehle tha (source text). en = English. hi = Devanagari Hindi. */
export type Lang = 'hinglish' | 'en' | 'hi';
const KEY = 'bd.lang';
const PICKED = 'bd.lang.picked';

type LangState = {
  lang: Lang;
  /** user ne pehli baar bhasha chun li? (nahi to shuru mein puchte hain) */
  picked: boolean;
  /** saved bhasha storage se padh li gayi? */
  ready: boolean;
  setLang: (l: Lang) => void;
};

export const useLang = create<LangState>((set) => ({
  lang: 'hinglish',
  picked: false,
  ready: false,
  setLang: (lang) => {
    set({ lang, picked: true });
    cache.clear();
    secureStorage.set(KEY, lang).catch(() => undefined);
    secureStorage.set(PICKED, '1').catch(() => undefined);
  },
}));
Promise.all([secureStorage.get(KEY), secureStorage.get(PICKED)])
  .then(([v, p]) => {
    useLang.setState({ lang: v === 'en' || v === 'hi' || v === 'hinglish' ? v : 'hinglish', picked: p === '1', ready: true });
  })
  .catch(() => useLang.setState({ ready: true }));
setTimeout(() => useLang.setState({ ready: true }), 2500); // storage atke to bhi app khule

const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
const esc = (s: string) => s.replace(/[.*+?^$()|[\]\\]/g, '\\$&');

/** Purane "Sunlo" wale text ka "Bondty" version bhi (app ka naam badal gaya) */
const rebranded: [string, string, string][] = DICT.filter((e) => e[0].includes('Sunlo')).map((e) => [
  e[0].replace(/Sunlo/g, 'Bondty'),
  e[1].replace(/Sunlo/g, 'Bondty'),
  e[2].replace(/Sunlo/g, 'Bondty'),
]);
const ALL: [string, string, string][] = [...DICT, ...rebranded, ...EXTRA]; // baad wala jeetta hai

const exact = new Map<string, [string, string]>();
const pats: { re: RegExp; en: string; hi: string; weight: number }[] = [];
for (const [src, en, hi] of ALL) {
  const k = norm(src);
  if (k.includes('{}')) {
    const re = new RegExp('^' + k.split('{}').map(esc).join('(.+?)') + '$', 's');
    pats.push({ re, en, hi, weight: k.replace(/\{\}/g, '').length });
  } else exact.set(k, [en, hi]);
}
pats.sort((a, b) => b.weight - a.weight);
const cache = new Map<string, string | null>();

function lookup(key: string, lang: 'en' | 'hi', depth = 0): string | null {
  const e = exact.get(key);
  if (e) return lang === 'en' ? e[0] : e[1];
  if (depth > 2) return null;
  for (const p of pats) {
    const m = p.re.exec(key);
    if (!m) continue;
    const caps = m.slice(1).map((c) => lookup(c, lang, depth + 1) ?? c);
    let i = 0;
    const t = lang === 'en' ? p.en : p.hi;
    return t.replace(/\{(\d*)\}/g, (_x, n: string) => caps[n ? Number(n) - 1 : i++] ?? '');
  }
  // "Hindi, English" jaisi bhasha-list: har naam alag badlo
  if (key.includes(', ')) {
    const parts = key.split(', ').map((x) => exact.get(x));
    if (parts.every(Boolean)) return parts.map((x) => (lang === 'en' ? x![0] : x![1])).join(', ');
  }
  // "Chat · ₹10/min" jaisi line: har hissa alag badlo
  if (key.includes(' · ')) {
    let any = false;
    const out = key.split(' · ').map((x) => {
      const t = lookup(x, lang, depth + 1);
      if (t !== null) any = true;
      return t ?? x;
    });
    if (any) return out.join(' · ');
  }
  return null;
}

const HI_MON: Record<string, string> = { Jan: 'जन', Feb: 'फ़र', Mar: 'मार्च', Apr: 'अप्रैल', May: 'मई', Jun: 'जून', Jul: 'जुल', Aug: 'अग', Sep: 'सित', Oct: 'अक्टू', Nov: 'नव', Dec: 'दिस' };
const HI_DAY: Record<string, string> = { Sun: 'रवि', Mon: 'सोम', Tue: 'मंगल', Wed: 'बुध', Thu: 'गुरु', Fri: 'शुक्र', Sat: 'शनि' };
const MON_RE = 'Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec';
/** Hindi mein tareekh/samay bhi Hindi: "13 Nov, 11:38 am" -> "13 नव, 11:38 पूर्वाह्न" */
function hiDates(s: string): string {
  if (!/\d/.test(s)) return s;
  return s
    .replace(new RegExp(`\\b(\\d{1,2}) (${MON_RE})\\b`, 'g'), (_m, d: string, mo: string) => `${d} ${HI_MON[mo]}`)
    .replace(/\b(Sun|Mon|Tue|Wed|Thu|Fri|Sat)(,? )(\d{1,2})\b/g, (_m, w: string, sep: string, d: string) => `${HI_DAY[w]}${sep}${d}`)
    .replace(/\b(\d{1,2}:\d{2}) ?(am|pm)\b/gi, (_m, t: string, ap: string) => `${t} ${ap.toLowerCase() === 'am' ? 'पूर्वाह्न' : 'अपराह्न'}`);
}

/** Hinglish text ko chuni hui bhasha mein badlo. Na mile to jaisa hai waisa. */
export function tr(input: string, langArg?: Lang): string {
  const lang = langArg ?? useLang.getState().lang;
  if (lang === 'hinglish' || typeof input !== 'string' || !input) return input;
  const key = norm(input);
  if (!key) return input;
  const ck = lang + '|' + key;
  let out = cache.get(ck);
  if (out === undefined) {
    out = lookup(key, lang);
    if (out === null && lang === 'hi') {
      const d = hiDates(key);
      if (d !== key) out = d;
    } else if (out !== null && lang === 'hi') out = hiDates(out);
    if (cache.size > 4000) cache.clear();
    cache.set(ck, out);
  }
  if (out === null) return input;
  return (input.match(/^\s*/)?.[0] ?? '') + out + (input.match(/\s*$/)?.[0] ?? '');
}

/** Alert popups bhi chuni hui bhasha mein */
const origAlert = Alert.alert.bind(Alert);
Alert.alert = ((title: string, message?: string, buttons?: { text?: string }[], options?: object) =>
  origAlert(
    tr(title),
    message ? tr(message) : message,
    buttons?.map((b) => (b.text ? { ...b, text: tr(b.text) } : b)) as never,
    options as never,
  )) as typeof Alert.alert;

export const LANG_LABEL: Record<Lang, string> = { hinglish: 'Hinglish', en: 'English', hi: 'हिंदी' };
