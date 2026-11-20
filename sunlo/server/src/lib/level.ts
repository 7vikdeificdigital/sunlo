import type { Settings } from './settings';

/** User aur vendor ka level: kitne minute baat hui uske hisaab se */
export type Level = 'BEGINNER' | 'INTERMEDIATE' | 'EXPERT';

export function levelOf(totalMinutes: number, s: Pick<Settings, 'levelIntermediateMinutes' | 'levelExpertMinutes'>): Level {
  if (totalMinutes >= s.levelExpertMinutes) return 'EXPERT';
  if (totalMinutes >= s.levelIntermediateMinutes) return 'INTERMEDIATE';
  return 'BEGINNER';
}

/** Is level par 1 coin kitne paise ka padta hai (kam = behtar) */
export function coinPaiseOf(level: Level, s: Pick<Settings, 'coinPaiseBeginner' | 'coinPaiseIntermediate' | 'coinPaiseExpert'>): number {
  const p = level === 'EXPERT' ? s.coinPaiseExpert : level === 'INTERMEDIATE' ? s.coinPaiseIntermediate : s.coinPaiseBeginner;
  // 1 coin = 100 paise se zyada mehnga kabhi nahi, aur 0 kabhi nahi (galat setting se bachav)
  return Math.min(100, Math.max(1, Math.round(p)));
}

/**
 * Level ka bonus: utne hi rupay mein kitne extra coins.
 * amount aur return dono paise/coin-units mein (1 coin = 100 units).
 * 1 coin 80 paise ka ho to Rs 100 ke 125 coins = 25 coins extra.
 */
export function levelBonusPaise(amount: number, level: Level, s: Pick<Settings, 'coinPaiseBeginner' | 'coinPaiseIntermediate' | 'coinPaiseExpert'>): number {
  const paise = coinPaiseOf(level, s);
  if (paise >= 100) return 0;
  return Math.max(0, Math.floor((amount * 100) / paise) - amount);
}
