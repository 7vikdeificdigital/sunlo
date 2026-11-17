# Play Billing setup (Bondty)

Code mein Play Billing pehle se hai (server verify + app). Ab sirf Play Console aur `.env` ki setting baaki hai.

## Billing modes (user-app build ke waqt)
| EXPO_PUBLIC_BILLING | Kya dikhta hai | EAS profile |
|---|---|---|
| `play` | Sirf Google Play | `production` (Play Store ki safe build) |
| `both` | Razorpay (UPI/Wallet/Card) + "Google Play" | `production-both` (sirf User Choice Billing enroll hone ke baad) |
| `razorpay` | Sirf Razorpay | `direct-apk` (seedha APK) |

## Play Console mein
1. Payments profile / merchant account banao (Setup > Payments profile).
2. In-app products banao (Monetize > Products > In-app products), Product ID bilkul aise:
   `coins_50`, `coins_100`, `coins_200`, `coins_500`, `coins_1000`, `coins_2000`
   (niyam: `coins_<rupaye>`; admin panel mein pack badle to product bhi usi raqam ka banao). Price = pack ki raqam (jaise coins_500 = Rs 500). Status: Active.
3. Service account: Google Cloud mein ek service account banao, Play Console > Users and permissions mein usko invite karo
   (permissions: "View financial data" + "Manage orders and subscriptions"). JSON key download karo.
4. Server `.env`:
   - `GOOGLE_PLAY_PACKAGE_NAME=com.bondty.app`
   - `GOOGLE_PLAY_SERVICE_ACCOUNT_BASE64=<JSON key ka base64>`  (PowerShell: `[Convert]::ToBase64String([IO.File]::ReadAllBytes("key.json"))`)
   Phir `pm2 restart bondty-backend --update-env`.
5. Testing: Setup > License testing mein tester Gmail daalo (asli paisa nahi katta). Internal testing track se install karo.
   Billing sirf Play Store se install hui build par chalti hai (seedha APK par nahi).

## User Choice Billing (Razorpay + Play dono) ke liye
Play Console > Monetisation settings > Alternative billing mein enroll karo. Enroll hone ke baad Google ki instructions
(transaction reporting) ke hisaab se server mein reporting jodni hogi. Tab tak Play Store build `production` (sirf Play) rakho.
