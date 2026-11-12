import path from 'node:path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

/** Har test run se pehle test database bilkul saaf karke naye sire se migrate */
export default async function setup() {
  const url = process.env.TEST_DATABASE_URL ?? 'postgresql://astroway:astroway_dev@localhost:5432/sunlo_test';
  const pool = new Pool({ connectionString: url });
  await pool.query('DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;');
  await migrate(drizzle(pool), { migrationsFolder: path.resolve(process.cwd(), 'drizzle') });
  // Purane tests purane niyam par likhe gaye hain: free trial / TDS band, live rooms + random video chalu.
  // Naye features ke tests in settings ko khud chalu/band karte hain (tests/compliance.test.ts, tests/care.test.ts).
  await pool.query(`insert into settings (key, value) values
    ('freeTrialMinutes', '0'), ('tdsEnabled', 'false'), ('liveRoomsEnabled', 'true'), ('randomVideoEnabled', 'true')`);
  await pool.end();
}
