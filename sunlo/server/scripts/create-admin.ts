import readline from 'node:readline';
import { eq } from 'drizzle-orm';
import { db, pool } from '../src/db/client';
import { users } from '../src/db/schema';
import { hashPassword, randomReferralCode } from '../src/lib/crypto';

/**
 * Admin account banana: `npm run create-admin -- admin@yourdomain.com`
 * Password terminal par poocha jaata hai (kahin save/print nahi hota).
 * Koi default ya pehle se bana admin NAHI hota (purane system mein tha).
 */
function ask(q: string, hidden = false): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  if (hidden) {
    const r = rl as unknown as { _writeToOutput: (s: string) => void; output: NodeJS.WriteStream };
    r._writeToOutput = (s: string) => {
      if (s.includes(q)) r.output.write(s);
      else r.output.write('*');
    };
  }
  return new Promise((res) =>
    rl.question(q, (a) => {
      rl.close();
      if (hidden) process.stdout.write('\n');
      res(a.trim());
    }),
  );
}

function strong(pw: string) {
  return pw.length >= 12 && /[a-z]/.test(pw) && /[A-Z]/.test(pw) && /\d/.test(pw) && /[^A-Za-z0-9]/.test(pw);
}

async function main() {
  const email = (process.argv[2] ?? (await ask('Admin email: '))).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Email sahi nahi hai');
  const pw = process.env.ADMIN_PASSWORD ?? (await ask('Password (12+ chars, A-z, 0-9, symbol): ', true));
  if (!strong(pw)) throw new Error('Password kamzor hai: 12+ characters, bade-chhote akshar, ank aur symbol zaroori');

  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const passwordHash = await hashPassword(pw);
  if (existing) {
    await db.update(users).set({ role: 'ADMIN', passwordHash, status: 'ACTIVE' }).where(eq(users.id, existing.id));
    console.log(`✅ ${email} ab ADMIN hai (password update hua)`);
  } else {
    await db.insert(users).values({ email, passwordHash, role: 'ADMIN', name: 'Admin', referralCode: randomReferralCode() });
    console.log(`✅ Admin bana: ${email}`);
  }
  await pool.end();
}

main().catch(async (e) => {
  console.error('❌', e instanceof Error ? e.message : e);
  await pool.end();
  process.exit(1);
});
