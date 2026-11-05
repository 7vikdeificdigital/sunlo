// VPS par server folder mein chalao:  node pushtest.js
// Secrets print nahi karti. Sirf project id, token ki ginti aur FCM ka jawab dikhati hai.
require('dotenv').config();
const { Pool } = require('pg');
const admin = require('firebase-admin');

(async () => {
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (!b64) { console.log('1) KEY: .env mein FIREBASE_SERVICE_ACCOUNT_BASE64 khaali/nahi hai  <-- yahi dikkat hai'); process.exit(1); }
  let sa;
  try { sa = JSON.parse(Buffer.from(b64, 'base64').toString('utf8')); }
  catch (e) { console.log('1) KEY: base64 padh nahi paya (galat copy hui?):', e.message); process.exit(1); }
  console.log('1) KEY: theek. project_id =', sa.project_id, '| client_email =', sa.client_email);
  if (sa.project_id !== 'sunloo-8babd') console.log('   DHYAN: project sunloo-8babd nahi hai, galat project ki key lagi hai');

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  let rows;
  try { rows = (await pool.query('select user_id, platform, token from device_tokens')).rows; }
  catch (e) { console.log('2) DB: device_tokens padh nahi paya:', e.message); process.exit(1); }
  console.log('2) TOKENS: DB mein', rows.length, 'device token hain');
  rows.forEach((r) => console.log('   user', r.user_id, r.platform, r.token.slice(0, 12) + '...'));
  if (!rows.length) { console.log('   Koi token nahi: app ne token bheja hi nahi (app ki taraf dikkat)'); process.exit(0); }

  const app = admin.initializeApp({ credential: admin.credential.cert(sa) });
  const res = await admin.messaging(app).sendEachForMulticast({
    tokens: rows.map((r) => r.token),
    // Bilkul asli server (lib/push.ts) jaisa message
    notification: { title: 'Bondty test', body: 'Ye test notification hai' },
    data: { type: 'test' },
    android: { priority: 'high', ttl: 60000, notification: { sound: 'default' } },
  });
  console.log('3) FCM: sent =', res.successCount, 'failed =', res.failureCount);
  res.responses.forEach((r, i) => { if (!r.success) console.log('   token', i, 'error:', r.error && r.error.code, '-', r.error && r.error.message); });
  process.exit(0);
})().catch((e) => { console.log('Error:', e.message); process.exit(1); });
