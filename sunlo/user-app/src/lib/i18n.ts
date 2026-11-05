import { Alert } from 'react-native';
import { create } from 'zustand';
import { DICT } from './dict';
import { secureStorage } from './storage';

/** hinglish = jaisa app pehle tha (source text). en = English. hi = Devanagari Hindi. */
export type Lang = 'hinglish' | 'en' | 'hi';
const KEY = 'bd.lang';

export const useLang = create<{ lang: Lang; setLang: (l: Lang) => void }>((set) => ({
  lang: 'hinglish',
  setLang: (lang) => {
    set({ lang });
    cache.clear();
    secureStorage.set(KEY, lang).catch(() => undefined);
  },
}));
secureStorage
  .get(KEY)
  .then((v) => {
    if (v === 'en' || v === 'hi' || v === 'hinglish') useLang.setState({ lang: v });
  })
  .catch(() => undefined);

const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
const esc = (s: string) => s.replace(/[.*+?^$()|[\]\\]/g, '\\$&');

const exact = new Map<string, [string, string]>();
const pats: { re: RegExp; en: string; hi: string; weight: number }[] = [];
for (const [src, en, hi] of DICT) {
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
  if (depth > 1) return null;
  for (const p of pats) {
    const m = p.re.exec(key);
    if (!m) continue;
    const caps = m.slice(1).map((c) => lookup(c, lang, depth + 1) ?? c);
    let i = 0;
    const t = lang === 'en' ? p.en : p.hi;
    return t.replace(/\{(\d*)\}/g, (_x, n: string) => caps[n ? Number(n) - 1 : i++] ?? '');
  }
  return null;
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
