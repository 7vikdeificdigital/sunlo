/**
 * Coins kharidne ka tareeka (build ke waqt tay):
 *  - EXPO_PUBLIC_BILLING=play     -> Google Play Billing (Play Store wali build)
 *  - kuch nahi / 'razorpay'       -> Razorpay (seedha APK / website wali build)
 */
export const BILLING_MODE: 'play' | 'razorpay' = process.env.EXPO_PUBLIC_BILLING === 'play' ? 'play' : 'razorpay';
