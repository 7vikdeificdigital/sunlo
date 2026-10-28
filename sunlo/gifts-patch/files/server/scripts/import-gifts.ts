import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { eq, inArray, sql } from 'drizzle-orm';
import { db, pool } from '../src/db/client';
import { gifts } from '../src/modules/gifts/schema';

/**
 * 3D gift animations (transparent WebM) + preview PNG ko DB mein daalta hai.
 * Chalane ka tareeka (server folder se):  npx tsx scripts/import-gifts.ts
 * Dobara chalane par sirf update hota hai (naam se match), duplicate nahi banta.
 */
type Item = { file: string; name: string; icon: string; price: number; sortOrder: number };

async function main() {
  const dir = path.resolve(process.cwd(), 'gift-assets');
  const manifest = JSON.parse(await readFile(path.join(dir, 'manifest.json'), 'utf8')) as Item[];
  for (const m of manifest) {
    const video = await readFile(path.join(dir, `${m.file}.webm`));
    const thumb = await readFile(path.join(dir, `${m.file}.png`));
    const [existing] = await db.select({ id: gifts.id }).from(gifts).where(eq(gifts.name, m.name)).limit(1);
    const media = { svgaData: video, mediaType: 'webm', thumbData: thumb, icon: m.icon, price: m.price, sortOrder: m.sortOrder, isActive: true };
    if (existing) {
      await db.update(gifts).set({ ...media, svgaVersion: sql`${gifts.svgaVersion} + 1` }).where(eq(gifts.id, existing.id));
    } else {
      await db.insert(gifts).values({ name: m.name, ...media, svgaVersion: 1 });
    }
    // eslint-disable-next-line no-console
    console.log('OK', m.name, `${(video.length / 1024).toFixed(0)} KB`);
  }
  // Purane placeholder emoji gifts (koi animation nahi) band kar do
  await db.update(gifts).set({ isActive: false }).where(inArray(gifts.name, ['Gulaab', 'Rocket', 'Taaj']));
  // eslint-disable-next-line no-console
  console.log('✅ Gifts import ho gaye');
  await pool.end();
}

main().catch(async (e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  await pool.end();
  process.exit(1);
});
