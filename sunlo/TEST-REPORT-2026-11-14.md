# Bondty: testing report (14 Nov 2026)

## Kya test kiya
| Hissa | Nateeja |
| --- | --- |
| Server automated tests | 256/256 pass (251 purane + 5 naye) |
| Server, user app, vendor app, admin panel: TypeScript | 0 error |
| User app aur vendor app: Android bundle (expo export) | Pehle FAIL, ab theek (neeche #1) |
| Admin panel build | Pass |
| Naye badlav: ek number = ek device, Cloudinary photo, MSG91 | Kaam kar rahe hain (alag se jaanche) |
| Load test: 100 log ek saath, listener list | ~470 request/second, sab safal, beech ka samay ~200 ms (2-core machine) |
| Dependency security audit | drizzle-orm 0.45.4 par update (SQL identifier advisory) + safe fixes |

## Jo kamiyan mili aur theek ki
1. **App build fail ho rahi thi.** `expo-audio` ki wajah se `expo-asset` ka galat version (58) aa raha tha, jo Expo 57 se mel nahi khaata. EAS build bhi isi par atakti. Dono apps mein `expo-asset ~57.0.19` joda; ab bundle banta hai.
2. **App ka naam phir "Sunlo" ho gaya tha** aur versionCode/buildNumber, autoIncrement, submit config hat gaye the. Wapas "Bondty" / "Bondty Partner" aur launch config lagaya. Admin panel ka title bhi Bondty.
3. **Play Store build Razorpay se coins bechti.** Google Play par digital coins ke liye Google Play Billing zaroori hai. `eas.json` production mein `EXPO_PUBLIC_BILLING=play` lagaya; Razorpay wali seedhi APK ke liye alag `direct-apk` profile.
4. **Vendor app mein account delete nahi tha.** Play Store ki zaroori shart. Account tab mein "Account delete karein" joda. Server: chalti call ya pending withdrawal ke beech delete nahi hota (paise ka hisaab bachta hai).
5. **Privacy Policy, Terms aur Delete-account ke public web page nahi the** (Play Console aur App Store dono maangte hain). Server par bane:
   - `https://api.bondty.com/api/v1/legal/privacy`
   - `https://api.bondty.com/api/v1/legal/terms`
   - `https://api.bondty.com/api/v1/legal/delete-account`
6. **Admin panel ki `dist` localhost se judi thi.** Production build ab default `https://api.bondty.com/api/v1` (badalna ho to `BONDTY_API_URL`).
7. **`.env.example` gayab tha** (README isi ka zikr karta hai). Saari settings ke saath bana diya.
8. Production mein Agora keys na hon to server ab shuru nahi hota (warna call chupchap fail hoti). `TRUST_PROXY` aur Google Play keys na hon to chetavni.

## Launch se pehle aapko karna hai (code se bahar)
1. **iOS: Apple In-App Purchase.** iPhone par coins abhi Apple ke system se nahi bikte; App Store reject karega. Android pehle launch karein.
2. **Company ki jaankari:** `user-app/src/lib/legalText.ts`, `vendor-app/src/lib/legalText.ts` aur `server/src/content/legalText.ts` mein `legalName`, `address`, `jurisdictionCity`, `supportEmail` khaali hain. Terms vakeel se dikhwayein.
3. **Admin > Setup:** Grievance Officer ka naam, email, phone, pata (IT Rules ke liye zaroori, aur upar ke pages par dikhta hai).
4. **Server `.env`:** `TRUST_PROXY=true` (Render/Railway/Nginx ke peeche), `CORS_ORIGINS`, Agora, Razorpay, `GOOGLE_PLAY_*`, `PAYOUT_ENC_KEY` (backup rakhein).
5. **Reviewer login:** production mein TEST_LOGINS band hai. `AUTH_MODE=firebase` rakhein aur Firebase console mein ek test phone number + OTP banakar Play/App Store review notes mein dein.
6. **Play Console:** coins ke products (pack IDs) Play Console mein banayein; Data safety form `legal/privacy` page ke hisaab se bharein; content rating; target audience 18+.
7. Kam se kam 2 asli Android phone par poora flow (login, recharge, chat, call, video, withdrawal) ek baar haath se chalayein. Calls/notification jaisi cheezein automated test se nahi pakdi ja saktin.

## Jaanne layak (abhi ke liye theek)
- Server ek hi machine (instance) par chalne ke liye bana hai: rate limit aur socket memory mein. Shuruaati launch ke liye kaafi; badi traffic par doosra server jodne se pehle Redis lagana hoga.
- Ek number = ek device: Play ke pre-launch test kai phone par ek saath login karein to ek-doosre ko logout karenge. Nuksaan nahi, bas report mein dikhega.
- `zod` ki ek memory advisory ka fix sirf zod 4 mein hai (bada badlav). Request ki seema 100 KB hai, isliye khatra kam.
- Zip mein Windows ke `node_modules` the; naye zip se hata diye. `npm install` khud chalayein.
