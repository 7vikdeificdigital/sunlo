# Sunlo Partner: Vendor App (React Native + Expo)

Listeners/experts ke liye app:
1. OTP se signup
2. 3 step ki profile: parichay, topics/bhasha, photo + ID document
3. Admin ki approval
4. Online/offline, aur naye request ka popup (accept/reject)
5. Chat aur call
6. Kamai ka hisaab, bank/UPI details, withdrawal
7. Reviews ka jawab, rate aur services

**Stack:** Expo SDK 57, Expo Router, TypeScript, TanStack Query, Socket.IO, Agora, expo-image-picker.

## Chalana

```bash
npm install
EXPO_PUBLIC_API_URL=http://<computer-ka-LAN-IP>:4000/api/v1 npx expo start
```

Demo vendor login (development seed): `+91 0000000001` se `0000000009`. OTP server ke terminal mein dikhta hai.

Production mein login **Firebase Phone Auth** se ho sakta hai (server `AUTH_MODE=firebase`). Isme Expo Go nahi chalta, development build chahiye; `google-services.json` is folder mein rakhein. Poora setup: `../FIREBASE_SETUP.md`.

## Profile ki halat

Profile ki halat ke hisaab se app apne aap sahi screen dikhati hai:

| Halat | Screen |
|---|---|
| DRAFT / REJECTED | Onboarding form (reject ho to admin ka sandesh upar) |
| PENDING | "Review mein hai" |
| SUSPENDED | Wajah aur support |
| APPROVED | Dashboard (Home, Sessions, Kamai, Reviews, Account) |

## Dhyan dein

- Naye request ka popup abhi tab aata hai jab app khuli ho (socket + har 10 sec check). App band hone par ghanti ke liye push notifications (FCM) agla kadam hai.
- App ke background mein jaane ke 60 second baad vendor server par apne aap offline ho jaata hai, taaki users offline vendor ko request na bhejein.
- Store build: `app.json` mein `com.yourcompany.sunlo.partner` apne naam se badlein.
