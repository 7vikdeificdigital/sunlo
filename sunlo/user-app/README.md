# Sunlo: User App (React Native + Expo)

Users ke liye app:
- category se listener ya expert chunna
- chat, voice aur video call
- wallet recharge
- history, favorites, review, report aur block
- madad (helpline) screen

**Stack:** Expo SDK 57, Expo Router, TypeScript, TanStack Query, Zustand, Socket.IO, Agora (calls).

## Chalana

```bash
npm install
EXPO_PUBLIC_API_URL=http://<computer-ka-LAN-IP>:4000/api/v1 npx expo start
```

- **Expo Go:** login (server `AUTH_MODE=otp` par), chat, wallet chalta hai. **Firebase login** (`AUTH_MODE=firebase`) aur call ke liye development build chahiye (setup: `../FIREBASE_SETUP.md`). Development build (Agora native module bhi isi mein aata hai):
  `npx expo prebuild && npx expo run:android`, ya `npx eas-cli build --profile development`.
- Server ka address `app.json` → `expo.extra.apiUrl` mein bhi set kar sakte hain.

## Store build

`app.json` mein `android.package` / `ios.bundleIdentifier` badlein (abhi `com.yourcompany.sunlo`). Phir build karein:

```bash
npx eas-cli build --platform android --profile production
```

Signing key EAS khud sambhalta hai. Keystore ya password kabhi code mein na rakhein.

## Folder

```
src/app/(auth)        login, otp
src/app/(app)/(tabs)  Home, Chat, Call, History, Account
src/app/(app)/        vendor/[id], session/[id] (chat), call/[id], wallet, payment, help, favorites, profile, notifications, support
src/components        UI, VendorCard, StartSessionSheet, ReportSheet, CallView
src/lib               api (auto token refresh), auth, socket, queries
```

## Suraksha aur bharosa

- Login token phone ke encrypted SecureStore mein rehta hai. App mein koi secret nahi hai.
- 18+ ki pushti zaroori hai. Vendor ko user ka sirf pehla naam dikhta hai.
- Chat mein phone number, email aur WhatsApp jaise shabd server par hi chhup jaate hain.
- "Madad" screen par Tele-MANAS (14416) aur 112 hain, aur saaf likha hai ki listeners doctor/therapist nahi hain.
