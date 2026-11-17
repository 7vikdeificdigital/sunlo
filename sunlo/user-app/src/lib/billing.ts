/**
 * Coins kharidne ka tareeka (build ke waqt tay):
 *  - EXPO_PUBLIC_BILLING=play     -> sirf Google Play Billing (Play Store ki safe build)
 *  - EXPO_PUBLIC_BILLING=both     -> Razorpay (UPI/Wallet/Card) + "Google Play" dono option
 *                                    (sirf tab, jab Play Console mein User Choice Billing enroll ho chuki ho)
 *  - kuch nahi / 'razorpay'       -> sirf Razorpay (seedha APK / website wali build)
 */
type Mode = 'play' | 'razorpay' | 'both';
const raw = process.env.EXPO_PUBLIC_BILLING;
export const BILLING_MODE: Mode = raw === 'play' || raw === 'both' ? raw : 'razorpay';
