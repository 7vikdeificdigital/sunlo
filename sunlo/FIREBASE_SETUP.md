# Firebase Phone Login: setup guide

OTP login ke do tareeke hain. Server ki `.env` mein `AUTH_MODE` se chunte hain:

| `AUTH_MODE` | OTP kaun bhejta hai | Kab use karein |
|---|---|---|
| `firebase` | **Firebase (Google)**. DLT ki zaroorat nahi | Production, jab tak MSG91/DLT approved na ho |
| `otp` (default) | Hamara server (MSG91 ya development mein terminal) | Local development, browser testing, ya baad mein DLT milne par |

Dono ek hi code mein hain, kabhi bhi `AUTH_MODE` badal sakte hain. Baaki sab (wallet, sessions, tokens) same rehta hai kyunki login phone number par hi chalta hai.

## Flow

1. App Firebase se OTP maangti hai, Google SMS bhejta hai.
2. User OTP dalta hai, Firebase app ko **ID token** deta hai.
3. App ye token `POST /auth/firebase` par bhejti hai.
4. Server `firebase-admin` se token verify karta hai (sirf **phone** se bana, **5 minute se taza** token chalta hai), **verified phone number** nikaalta hai, aur wahi se purana login chalta hai: user banana, role check (user/vendor alag number), apne access + refresh tokens dena.

Login ka faisla hamesha **hamara server** karta hai. Firebase sirf batata hai ki "yeh number verify hua".

## Aapko karna kya hai

### 1. Firebase project
1. https://console.firebase.google.com par project banayein.
2. **Build → Authentication → Sign-in method → Phone** ko enable karein.
3. Phone auth ke SMS ke liye **Blaze (pay-as-you-go) plan** chahiye ho sakta hai. Free quota aur India ka SMS rate Firebase ke pricing page par check karein.
4. **Authentication → Settings → SMS region policy**: sirf **India** allow karein (fake OTP requests se bill badhne se bachata hai).

### 2. Dono apps register karein
Firebase mein **do Android apps** jodein (aur iOS chahiye to do iOS apps):

| App | Android package | iOS bundle id |
|---|---|---|
| user-app | `com.yourcompany.sunlo` | `com.yourcompany.sunlo` |
| vendor-app | `com.yourcompany.sunlo.partner` | `com.yourcompany.sunlo.partner` |

(Pehle `app.json` mein asli package name badal lein, aur Firebase mein wahi daalein.)

Har Android app mein **SHA-1 aur SHA-256** fingerprint daalna zaroori hai, warna OTP nahi aayega:
- EAS build ke liye: `npx eas-cli credentials` se keystore ka SHA dekhein.
- **Play Store** par daalne ke baad Play Console → App integrity se **App signing key** ka SHA-1/SHA-256 bhi Firebase mein jodein.

Phir:
- `google-services.json` download karke `user-app/` aur `vendor-app/` mein rakhein (har app ki apni file).
- iOS ke liye `GoogleService-Info.plist` bhi isi tarah. iOS mein APNs key bhi Firebase mein upload karni hoti hai.

### 3. Server
1. Firebase console → **Project settings → Service accounts → Generate new private key**.
2. JSON ko base64 karein: `base64 -w0 service-account.json`
3. Server ki `.env` mein:
   ```
   AUTH_MODE=firebase
   FIREBASE_SERVICE_ACCOUNT_BASE64=<upar wali lambi string>
   ```
4. Is JSON ko kabhi git/zip/app mein na daalein. Sirf server ki `.env` mein rahe.

`AUTH_MODE=firebase` ho to server ka apna OTP route (`/auth/otp/*`) band ho jaata hai, aur `MSG91_*` settings ki zaroorat nahi.

### 4. Apps build karein (Expo Go nahi chalega)
Firebase native module hai, isliye **development build / EAS build** chahiye (Agora ke liye bhi yehi chahiye tha):

```bash
cd user-app
npm install
npx eas-cli build:configure          # pehli baar (eas.json banata hai)
npx eas-cli build --platform android --profile development
```

Ya local par: `npx expo prebuild && npx expo run:android`.
Vendor app ke liye `vendor-app/` mein yehi.

App `GET /auth/config` se server ka mode khud jaan leti hai, alag app build ki zaroorat nahi.

### 5. Abuse se bachav (launch se pehle)
- **Firebase App Check** (Play Integrity) chalu karein, taaki sirf aapki asli app OTP maange. Bina iske koi bhi aapke project ke naam se SMS bhej ke bill badha sakta hai.
- Firebase console mein SMS usage/budget alert lagayein.

## Testing

- **Firebase console → Authentication → Phone → "Phone numbers for testing"**: wahan fake numbers aur fix OTP set karein (jaise `+91 99999 99999` → `123456`). Inme asli SMS nahi jaata aur kharch nahi lagta. Development mein yehi use karein.
- **Browser (web) mein Firebase login nahi chalta.** Browser testing ke liye server ko `AUTH_MODE=otp` par chalayein (OTP terminal mein dikhega), jaisa pehle chalta tha.
- Server tests: `cd server && npm test`. Firebase login ke 11 naye tests `tests/firebase.test.ts` mein hain; ye asli Firebase ko chhue bina chalte hain.

## Dhyaan rakhne wali baatein

- **Delivery:** Firebase ka SMS India mein kabhi late aata hai ya nahi aata. Launch ke baad dekhte rahein. Agar badhiya na chale to DLT karwa ke `AUTH_MODE=otp` (MSG91) par wapas ja sakte hain.
- **Android auto-verify:** kabhi Firebase khud verify kar deta hai, tab user ko OTP dalna hi nahi padta. App ye sambhalti hai.
- **Rate limits:** server ka 5-OTP-per-hour wala niyam sirf `otp` mode mein hai. `firebase` mode mein limits Firebase ki hain (isliye App Check zaroori hai).
- **Resend:** naya OTP maangne par Firebase naya SMS bhejta hai; bahut jaldi-jaldi maangne par `too-many-requests` aa sakta hai.
