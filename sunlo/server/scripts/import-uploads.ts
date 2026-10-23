/**
 * Purani files (server/uploads/*.jpg|png|webp|pdf) ko database mein daalta hai, taaki hosting par bhi dikhein.
 * Chalao:  npm run db:import-uploads      (DATABASE_URL wahi jo .env mein hai)
 * Sirf un rows ko bharta hai jinka data khaali hai; dobara chalane par koi nuksaan nahi.
 */
import 'dotenv/config';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { and, eq, isNull } from 'drizzle-orm';
import { db, pool } from '../src/db/client';
import { uploads } from '../src/db/schema';

const dir = path.resolve(process.env.UPLOAD_DIR ?? './uploads');
const KEY = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|webp|pdf)$/;

async function main() {
  const files = (await readdir(dir)).filter((f) => KEY.test(f));
  let done = 0;
  for (const f of files) {
    const data = await readFile(path.join(dir, f));
    const res = await db
      .update(uploads)
      .set({ data })
      .where(and(eq(uploads.storageKey, f), isNull(uploads.data)))
      .returning({ id: uploads.id });
    if (res.length) done += 1;
  }
  console.log(`✅ ${done} file database mein daali gayi (${files.length} mili ${dir} mein)`);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
