# Bondty update: Sarkari niyam + naye features (10 Nov 2026)

Server: **251 tests pass** (225 purane + 26 naye: `tests/compliance.test.ts`, `tests/care.test.ts`).
Admin panel `npm run build` pass. User app aur Partner app `npm run typecheck` pass.

## Deploy kaise karein

```bash
cd server && npm run db:migrate     # nayi migration: drizzle/0006_compliance_care.sql (purane DB par bhi safe)
cd admin-panel && npm run build
```
Phir dono apps ka naya build (EAS) banayein.

**Launch se pehle admin panel mein yeh karein:**
1. **Settings → Grievance Officer**: naam, email, phone, pata bharein (IT Rules mein zaroori).
2. **Compliance → Admin 2FA**: har admin ke liye Authenticator app chalu karein.
3. **Settings → Feature switches**: Live Rooms aur Random video abhi band hain (default). Moderation taiyaar hone par hi chalu karein.
4. TDS ke niyam (Rs 5 lakh chhoot, quarterly return) **CA se pakke** karein. Zaroorat ho to `TDS` switch / rate Settings mein badlein.
5. Terms/Privacy text (`user-app/src/lib/legalText.ts`, `vendor-app/src/lib/legalText.ts`) **vakil se** dikhwa lein.

## Bug fix
- `drizzle/0001_upload_data.sql` migration journal mein nahi thi: naye database par **photo/KYC upload fail** hota tha. Ab 0006 mein `ADD COLUMN IF NOT EXISTS` se theek.
- Admin vendor detail API mein encrypted PAN field nahi bheja jaata.

## Sarkari niyam

| Niyam | Kya badla |
|---|---|
| IT Rules 2026: shikayat 7 din, ghair-kanooni content 36 ghante | Ticket mein category + deadline (`dueAt`), turant pavti (ticket number `GR-XXXX`), admin ko SLA list + overdue. Report par 36 ghante. |
| IT Rules: Grievance Officer dikhana | Public `GET /grievance`, app config mein; user app mein "Shikayat / Grievance Officer" screen. |
| IT Rules 2026: court/sarkari order par 3 ghante | Admin → Compliance → Takedown: user/vendor/message/room/voice note/review turant hatao + record (order, kab mila, kab hataya, der hui ya nahi). |
| IT Rules 2026: har 3 mahine niyamon ka notice | Admin se "Abhi bhejein" + server 90 din par khud bhejta hai. |
| Play Store / Delhi HC sakhti | Feature switches: `liveRoomsEnabled` (default band), `randomVideoEnabled` (default band), `videoCallsEnabled`, `giftsEnabled`. Server bhi rokta hai (purani app se bhi nahi chalega). |
| CCPA dark patterns | Call se pehle keemat: `GET /sessions/quote` (rate, GST sahit rate, "adhoora minute poora gina jayega", kitne minute milenge). Session par `pricingAckAt`. Balance khatam hone se 1 min pehle chetavani (`session:low_balance`). Har session ki raseed `GET /sessions/:id/receipt`. |
| RBI closed-system coins | Coins cash/transfer nahi (pehle se). Naya: recharge ka refund **sirf original source** par (`POST /admin/payments/:id/refund-to-source`, Razorpay refund API), coins kharch hue hon to nahi. |
| TDS (Sec 393 / 194-O) | Har kamai (session, gift, room) par gross ka TDS: PAN ke saath 0.1%, bina PAN 5% (ledger type `TDS`). Vendor PAN encrypted (`PUT /vendor/pan`), submit aur withdrawal ke liye zaroori. Vendor ka mahine ka statement. Admin TDS report quarter-wise + CSV (poora PAN, audit log mein). |
| DPDP Act + Rules 2025 | Janm-tithi se 18+ jaanch (naabaalig ki tareekh save nahi), privacy notice par sahmati ka version + samay, `GET /me/export` (apna data), `POST /me/consent/withdraw` (sab mitao), chat 90 din baad auto-delete (khuli shikayat wale rahenge). Purane users ko ek baar sahmati screen. |
| Admin suraksha | Admin login par TOTP 2FA (Google/Microsoft Authenticator). |

## Naye (trendy) features

| Feature | Kaise chalta hai |
|---|---|
| **Pehle 5 minute free** | Naye number ko ek baar (account delete karke dobara nahi). Sirf Rs 20/min tak ke listener, chat/voice. Free minute ka paisa platform deta hai, listener ko poori kamai. Settings se minute/rate badlein, 0 = band. |
| **Mood se match** | Connect screen par mood chips (breakup, akelapan, stress, parivaar, overthinking, ghar ki yaad) + "Sirf mahila listener". Server pehle us topic ke tag/category wale listener dhoondhta hai; na mile to koi bhi (gender ki shart kabhi nahi tootti). |
| **Call schedule** | Listener ki profile se "Baad ka time book karein" (7 din, 15-60 min). Listener confirm/decline karta hai, 10 min pehle dono ko reminder, samay par "Shuru karein". Ek user max 3 booking; listener ka slot double-book nahi hota. |
| **Roz ka mood check-in** | 1 tap emoji, streak, 14 din ka chart, note encrypted. Lagaatar 3 din udaas ho to narmi se listener + Tele-MANAS 14416 ka sujhav (diagnosis nahi). Raat 9:30 reminder sirf marzi se. |

## Nayi APIs

User: `GET /sessions/quote`, `GET /sessions/:id/receipt`, `POST /me/consent`, `POST /me/consent/withdraw`, `GET /me/export`, `GET /grievance` (public), `POST|GET /scheduled-calls`, `POST /scheduled-calls/:id/start|cancel`, `POST|GET|DELETE /checkins`. `POST /random/connect` mein `mood`, `listenerGender`, `language`.

Vendor: `PUT /vendor/pan`, `GET /vendor/statement?month=YYYY-MM`, `GET /vendor/scheduled-calls`, `POST /vendor/scheduled-calls/:id/confirm|decline`.

Admin: `GET /admin/compliance/overview`, `GET /admin/grievances`, `GET|POST /admin/takedowns`, `POST /admin/policy-notice`, `GET /admin/tds-report`, `POST /admin/payments/:id/refund-to-source`, `POST /admin/2fa/setup|enable|disable`, `GET /admin/compliance/retention`.

## Abhi baaki (jaan-boojh kar)
- **DigiLocker / KYC se umar ki pakki jaanch** (DPDP 13 May 2027 se): abhi janm-tithi se jaanch hai. DigiLocker partner API milne par `PATCH /me` mein jod sakte hain.
- Chat mein AI moderation (gaali/ashleel) abhi keyword list se hai; Live Rooms chalu karne se pehle AI audio/video moderation lagayein.
- User app ka web bundle (`expo export -p web`) purane `expo-asset` / `expo` version mismatch ki wajah se nahi banta (yeh is update se pehle se tha); native build par asar nahi, phir bhi `npx expo install --fix` chala lein.
