import { sql } from 'drizzle-orm';
import { users } from '../db/schema';

/**
 * Listener ko user ka kaun sa naam dikhe.
 * User ne "naam chhupao" chuna ho to asli naam ki jagah @username.
 */
export const userDisplayName = sql<string>`case
  when ${users.anonymous} then '@' || coalesce(${users.username}, 'user')
  else coalesce(nullif(btrim(${users.name}), ''), '@' || coalesce(${users.username}, 'user'))
end`;

/** Row se naam (jab select mein poora user aaya ho) */
export function displayNameOf(u: { name: string | null; username: string | null; anonymous?: boolean | null }): string {
  const uname = `@${u.username ?? 'user'}`;
  if (u.anonymous) return uname;
  return u.name?.trim() ? u.name.trim() : uname;
}

/** Listener ko sirf pehla naam dikhta hai; @username poora rehta hai */
export const firstName = (shown: string | null | undefined) => (shown?.startsWith('@') ? shown : (shown?.split(' ')[0] ?? 'User'));
