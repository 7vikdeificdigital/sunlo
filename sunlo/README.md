# Sunlo: Listeners & Experts se baat karne ka platform

Log apni pareshani share karte hain. Trained **listeners** sunte hain, aur **experts** (career, legal, finance, fitness...) salah dete hain. Baat **chat, voice call ya video call** par hoti hai, aur paisa per-minute wallet se katta hai.

```
sunlo/
  server/        Node.js + TypeScript + PostgreSQL backend (API + real-time chat)
  user-app/      React Native (Expo): users ke liye app            "Sunlo"
  vendor-app/    React Native (Expo): listeners/experts ki app     "Sunlo Partner"
  admin-panel/   React (web): admin panel                          "Sunlo Admin"
```

> Naam "Sunlo" sirf sujhav hai. Badalne ke liye: `server/src/lib/settings.ts` (appName), dono apps ka `app.json` (name, package), aur admin panel ka `index.html`.

## Kaun kya karta hai

| | User app | Vendor app | Admin panel |
|---|---|---|---|
| Login | Mobile OTP | Mobile OTP (alag number) | Email + password |
| Profile | Naam, 18+ pushti | Parichay, topics, bhasha, photo, **ID document** | — |
| Baat-cheet | Vendor chunna, chat/call/video request | Request popup → accept/reject, chat/call | Chat transcript dekhna (audit ke saath) |
| Paisa | Wallet recharge (Razorpay) | Kamai, bank/UPI, withdrawal request | Payout karna (UTR darj), refund, wallet adjust |
| Bharosa | Review, report, block, helpline | Review ka jawab | Vendor approve/reject/suspend, reports, tickets |
| Setup | — | Apna rate (admin ki seema mein) | Categories, commission, rate seema, packs, banners, band shabd |

## Paisa kaise chalta hai

1. User ₹500 ka recharge karta hai aur ₹590 deta hai (18% GST). Wallet mein ₹500 aate hain, aur pack ka bonus ho to woh bhi.
2. Session chalta hai. Har shuru hue minute ka vendor ka rate katta hai.
3. Platform commission (default 30%) kat kar baaki vendor ke wallet mein jaata hai.
4. Vendor withdrawal maangta hai. Raqam turant hold ho jaati hai.
5. Admin bank/UPI par paisa bhejta hai aur UTR darj karta hai. Agar admin reject kare, to raqam vendor ke wallet mein wapas aa jaati hai.

## Jaanch

**Backend:** 140 automated tests asli PostgreSQL par pass hote hain (`cd server && npm test`). Inme yeh check hota hai:
- har API bina login band hai, aur har admin API user/vendor ke liye `403` hai
- OTP leak nahi hota
- SQL injection kaam nahi karta
- nakli file upload (jaise HTML ko PNG bata kar) reject hota hai
- bank account DB mein encrypted rehta hai
- payment do baar credit nahi hota
- billing aur commission ka hisaab sahi hai
- withdrawal reject aur session refund sahi chalte hain

**Teeno apps ek saath:** browser mein 30 kadam ka flow chalaya gaya, bina kisi error ke:
1. Naya vendor signup karta hai, photo aur ID upload karta hai
2. Admin document dekh kar approve karta hai
3. Vendor online hota hai
4. User recharge karta hai aur chat request bhejta hai
5. Vendor app mein popup aata hai, vendor accept karke chat karta hai; user ka bheja phone number apne aap chhup jaata hai
6. User review deta hai, vendor uska jawab deta hai
7. Vendor UPI jod kar withdrawal maangta hai
8. Admin payout karke UTR darj karta hai, aur vendor ko "Bhej diya gaya" dikhta hai

## Local par chalana

```bash
# 1. Backend
cd server && npm install && cp .env.example .env    # .env mein dev values (server/README.md)
npm run db:migrate && npm run db:seed -- --demo
ADMIN_PASSWORD='Apna-Strong#Password1' npm run create-admin -- admin@yourdomain.com
npm run dev                                          # http://localhost:4000/api/v1

# 2. Admin panel
cd admin-panel && npm install && npm run dev         # http://localhost:5173

# 3. Apps
cd user-app && npm install && npx expo start         # Expo Go / emulator / web
cd vendor-app && npm install && npx expo start
```

Development mein OTP server ke terminal mein dikhta hai, aur payment "demo mode" mein chalta hai.

### Production login: Firebase Phone Auth (DLT ke bina)

SMS ke liye DLT approved nahi hai to **Firebase Phone Auth** use kar sakte hain: server `.env` mein `AUTH_MODE=firebase`. OTP Google bhejta hai aur MSG91 ki zaroorat nahi. Poora setup (Firebase console, SHA keys, `google-services.json`, EAS build, App Check): **[FIREBASE_SETUP.md](FIREBASE_SETUP.md)**. Local development aur browser testing ke liye `AUTH_MODE=otp` (default) chalta rehta hai.

## Abhi kya baaki hai (production se pehle)

- **Firebase login setup:** code taiyaar hai (`FIREBASE_SETUP.md`). Firebase project, `google-services.json`, SHA keys, App Check aur asli phone par development build mein test baaki hai. Expo Go mein Firebase login nahi chalta.
- **Push notifications (FCM):** app band ho tab bhi vendor ko request ki ghanti aaye, iske liye yeh zaroori hai. Abhi request app khuli hone par (popup) aur in-app notification se aati hai.
- **Audio/video call:** code likha hai (Agora), par asli phone par test baaki hai. Iske liye Agora account aur development build chahiye.
- **Admin ke liye 2-factor login (TOTP):** sujhav hai.
- **File storage:** uploads abhi server ki disk par hain. Zyada traffic ke liye S3 jaisa storage lagayein.
- **Legal:** Terms of Use, Privacy Policy aur Refund Policy ke pages vakil se banwayein. Listener service ke liye "hum medical/therapy service nahi hain" ka disclaimer app mein hai, par legal salah zaroor lein.

Detail mein setup: `server/README.md`, `user-app/README.md`, `vendor-app/README.md`, `admin-panel/README.md`.
