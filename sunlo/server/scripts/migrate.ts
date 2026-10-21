import { migrate } from 'drizzle-orm/node-postgres/migrator';
import path from 'node:path';
import { db, pool } from '../src/db/client';

/** Database tables banana/update karna: `npm run db:migrate` */
async function main() {
  await migrate(db, { migrationsFolder: path.resolve(process.cwd(), 'drizzle') });
  // eslint-disable-next-line no-console
  console.log('✅ Migrations ho gaye');
  await pool.end();
}

main().catch(async (e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  await pool.end();
  process.exit(1);
});
