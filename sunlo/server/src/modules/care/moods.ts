import { sql, type SQL } from 'drizzle-orm';
import { vendors } from '../../db/schema';

/**
 * "Mood se match": user batata hai ki mann mein kya chal raha hai, hum us vishay ke listener dhoondhte hain.
 * Listener ke tags / category slug inme se kisi se mile to "on-topic" match.
 * Yeh diagnosis nahi hai: sirf sahi listener tak pahunchane ka tareeka.
 */
export const MOODS = [
  { key: 'breakup', label: 'Breakup / dil toota', icon: 'heart-dislike-outline', tags: ['breakup', 'relationship', 'rishte', 'love', 'pyaar'] },
  { key: 'lonely', label: 'Akelapan', icon: 'person-outline', tags: ['loneliness', 'lonely', 'akelapan', 'friendship', 'dosti'] },
  { key: 'stress', label: 'Kaam / padhai ka stress', icon: 'flash-outline', tags: ['stress', 'career', 'exam', 'work', 'padhai', 'job'] },
  { key: 'family', label: 'Ghar-parivaar, shaadi', icon: 'home-outline', tags: ['family', 'parivaar', 'marriage', 'shaadi', 'sasural', 'parenting'] },
  { key: 'overthinking', label: 'Overthinking / bechaini', icon: 'cloudy-outline', tags: ['overthinking', 'anxiety', 'bechaini', 'neend', 'sleep'] },
  { key: 'homesick', label: 'Ghar ki yaad', icon: 'airplane-outline', tags: ['homesick', 'ghar', 'hostel', 'nri', 'abroad'] },
  { key: 'just_talk', label: 'Bas baat karni hai', icon: 'chatbubbles-outline', tags: [] as string[] },
] as const;

export type MoodKey = (typeof MOODS)[number]['key'];
export const MOOD_KEYS = MOODS.map((m) => m.key) as [MoodKey, ...MoodKey[]];
export const moodOf = (key: string) => MOODS.find((m) => m.key === key);

/** SQL: vendor ke tags ya category is mood se milte hain */
export function moodMatchSql(key: MoodKey): SQL | null {
  const m = moodOf(key);
  if (!m || !m.tags.length) return null;
  const tags = sql.raw(`ARRAY[${m.tags.map((t) => `'${t.replace(/'/g, "''")}'`).join(',')}]::text[]`);
  return sql`(exists(select 1 from unnest(${vendors.tags}) t where lower(t) = any(${tags}))
    or exists(select 1 from vendor_categories vc join categories c on c.id = vc.category_id where vc.vendor_id = ${vendors.id} and c.slug = any(${tags})))`;
}
