# Sunlo Backend (Node.js + TypeScript + PostgreSQL)

User app, Vendor app aur Admin panel, teeno isi ek server se chalte hain.

**Stack:** Node 20+, Express 5, Drizzle ORM, PostgreSQL 14+, Socket.IO (real-time chat), Zod (input validation), Razorpay, Agora, Firebase Phone Auth ya MSG91 (OTP).

---

## 1. Local par chalana (development)

```bash
# PostgreSQL mein database banayein
createdb sunlo

cd server
npm install
cp .env.example .env
```

`.env` mein development ke liye yeh rakhein:

```
NODE_ENV=development
DATABASE_URL=postgresql://USER:PASS@localhost:5432/sunlo
JWT_ACCESS_SECRET=<openssl rand -base64 48>
OTP_PEPPER=<openssl rand -base64 48>
SMS_PROVIDER=console      # OTP terminal mein dikhega
PAYMENT_PROVIDER=mock     # demo payment page
UPLOAD_DIR=./uploads
```

```bash
npm run db:migrate          # tables banayein
npm run db:seed -- --demo   # categories, recharge packs + 9 demo vendors
npm run dev                 # http://localhost:4000/api/v1
```

Demo vendors ke phone number `+910000000001` se `+910000000009` tak hain (vendor app se login ke liye).

## 2. Admin banana

Koi default admin **nahi** hai. Apna admin khud banayein:

```bash
npm run create-admin -- admin@yourdomain.com
# password terminal par poocha jayega (12+ characters, A-z, 0-9, symbol)
```

## 3. Tests

```bash
createdb sunlo_test
TEST_DATABASE_URL=postgresql://USER:PASS@localhost:5432/sunlo_test npm test
```

140 tests asli database par chalte hain. Inme yeh sab check hota hai:

- Har private API bina login `401` deti hai, aur har admin API user/vendor token se `403`. Yeh check apne aap har route par chalta hai, isliye naya route bhi bina login khula nahi reh sakta.
- Vendor ka onboarding se approval tak ka flow; approval se pehle vendor users ko nahi dikhta.
- Nakli file (jaise HTML ko PNG bata kar) reject hoti hai; KYC document public URL par nahi milta.
- Bank account DB mein encrypted rehta hai; withdrawal ki min raqam aur ek-pending niyam; reject par paisa wapas.
- Session refund mein user ko paisa wapas aur vendor ki kamai se kataui; dobara refund nahi.
- OTP response mein nahi aata. 5 galat koshish ke baad OTP band ho jaata hai, aur ek OTP sirf ek baar chalta hai.
- Refresh token chori hone par us login ke saare token band ho jaate hain.
- Block kiya gaya user turant bahar ho jaata hai. User apna role khud nahi badal sakta.
- SQL injection se kuch nahi tootta.
- Payment do baar credit nahi hota, 5 request ek saath aayein tab bhi. Raqam server tay karta hai, aur kisi aur ka payment verify nahi ho sakta.
- Wallet negative nahi ho sakta.
- Billing ka hisaab sahi hai: per-minute charge, 70/30 commission, ledger = balance.
- Balance khatam hote hi session apne aap band ho jaata hai. Beech mein recharge karne par samay badhta hai.
- Chat mein phone number aur WhatsApp jaise shabd chhup jaate hain. Bahar wala session room join nahi kar sakta.

## 4. Production (server par)

1. Ubuntu server par Node 20+, PostgreSQL aur Nginx (HTTPS ke saath) lagayein.
2. `.env` mein `NODE_ENV=production` rakhein aur saari keys asli dalein: login ke liye `AUTH_MODE=firebase` + `FIREBASE_SERVICE_ACCOUNT_BASE64` (dekhein `../FIREBASE_SETUP.md`) ya `AUTH_MODE=otp` + MSG91 (DLT chahiye), Razorpay, Agora, aur `PAYOUT_ENC_KEY` (`openssl rand -base64 32`; iska backup zaroor rakhein).
   - Galat ya demo setting ho to server **shuru hi nahi hoga** aur batayega ki kya kami hai.
3. `npm ci && npm run build && npm run db:migrate && npm run db:seed` (bina `--demo` ke).
4. `npm run create-admin -- you@yourdomain.com`
5. Server ko `pm2 start dist/index.js --name sunlo` ya systemd se chalayein. `UPLOAD_DIR` ko web root ke bahar rakhein aur uska backup lein.
6. Razorpay dashboard mein webhook URL dalein: `https://api.yourdomain.com/api/v1/webhooks/razorpay`, events `payment.captured` aur `order.paid`.
7. Nginx mein WebSocket (`Upgrade` headers) chalu rakhein, chat isi se chalti hai.

## 5. Purane system ki kamiyan aur unka ilaaj

| Purani kami | Naye backend mein |
|---|---|
| Admin APIs (vendor delete, withdrawal release, notification) bina login khuli thi | Sab routes default **band**. Sirf chuni hui public routes khuli hain. Role check alag se hota hai. Test har route par yeh check karta hai |
| Website login mein OTP browser ko bhej diya jaata tha | OTP sirf SMS se jaata hai (ya `firebase` mode mein Firebase check karta hai; server sirf verified ID token leta hai). Server par HMAC hash mein save hota hai. 5 min expiry, 5 attempts, 30 sec resend gap, per-IP rate limit |
| SQL injection (`whereRaw` mein search text) | Har query parameterized hai (Drizzle). LIKE search mein `%`/`_` escape hote hain |
| Default `superadmin@gmail.com` aur demo team accounts | Koi default account nahi. Admin sirf CLI se banta hai, password scrypt hash mein |
| Firebase Admin private key app ke andar | App mein koi secret nahi. Chat Socket.IO se hamare server par chalti hai. Firebase key (Phase 2 push) sirf server ke `.env` mein rahegi |
| `.env`, keystore, API keys zip/dump mein | Sirf `.env.example`. Production mein example/dev secrets par server shuru nahi hota |
| App se aayi payment amount par bharosa (`base64_decode(razorpayAmount)`) | Raqam, bonus aur GST server tay karta hai. Signature verify hota hai, Razorpay se status dobara check hota hai, aur webhook bhi verify hota hai. Row lock + unique ledger se double credit sambhav nahi |
| Per-minute billing app ke bharose | Timer aur billing server par hain. Balance khatam par server khud session band karta hai. Wallet DB constraint se negative nahi ho sakta |
| Contact share pakadna admin ke manual monitoring par | Server message save karne se pehle hi number, email aur keywords chhupa deta hai |
| Galti par stack trace / SQL bahar dikhta | Sirf saaf message bahar jaata hai. Log mein token/OTP/password redact hote hain |
| KYC/ID documents ki koi suraksha nahi | File ka type uske bytes se jaancha jaata hai. KYC sirf admin dekh sakta hai, aur har baar audit log banta hai |
| Withdrawal "release" bina login | Withdrawal vendor ke wallet se hold hota hai. Admin UTR ke saath pay ya reject karta hai, aur har kadam audit hota hai |
| Bank details plain text | Account number AES-256-GCM se encrypted rehta hai. Vendor ko sirf last 4 dikhte hain. Admin poora number tabhi dekh sakta hai jab withdrawal pending ho, aur woh bhi audit log mein darj hota hai |

## API ka naksha (short)

| Kaun | Routes |
|---|---|
| Public | `/app/config`, `/vendors`, `/vendors/:id`, `/vendors/:id/reviews`, `/banners`, `/support/faqs`, `/files/:id` (sirf photo), `/auth/*` |
| User | `/me`, `/wallet/*`, `/sessions/*`, `/vendors/:id/favorite|block`, `/me/favorites`, `/reports`, `/notifications`, `/support/tickets/*` |
| Vendor | `/vendor/me`, `/vendor/me/submit`, `/vendor/rates`, `/vendor/status`, `/vendor/sessions/*`, `/vendor/earnings`, `/vendor/payout-account`, `/vendor/withdrawals`, `/vendor/reviews/*`, `/uploads` |
| Admin | `/admin/*` (dashboard, vendors, users, sessions, payments, withdrawals, categories, settings, recharge-packs, banners, keywords, tickets, reports, reviews, audit-logs) |
| Real-time | Socket.IO: `session:join`, `chat:send`, `chat:typing`, `session:incoming`, `session:update`, `notification` |
