import { PermissionsAndroid, Platform } from 'react-native';
import { api } from './api';

type Messaging = () => {
  getToken: () => Promise<string>;
  deleteToken: () => Promise<void>;
  onTokenRefresh: (cb: (t: string) => void) => () => void;
};

let current: string | null = null;

/** Firebase Cloud Messaging module juda hai to usse, warna null (Expo Go / purani build mein push nahi chalegi, app chalti rahegi) */
function loadMessaging(): Messaging | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const m = require('@react-native-firebase/messaging') as { default?: Messaging };
    return m.default ?? null;
  } catch {
    return null;
  }
}

const send = (token: string) => api('/me/devices', { method: 'POST', body: { token, platform: Platform.OS === 'ios' ? 'ios' : 'android' } }).catch(() => undefined);

/** Login ke baad: notification ki anumati, FCM token server ko, aur token badle to naya bhi. Cleanup function lautata hai. */
export async function registerPush(): Promise<() => void> {
  try {
    const messaging = loadMessaging();
    if (!messaging) return () => undefined;
    if (Platform.OS === 'android' && Number(Platform.Version) >= 33) {
      const r = await PermissionsAndroid.request('android.permission.POST_NOTIFICATIONS' as never);
      if (r !== PermissionsAndroid.RESULTS.GRANTED) return () => undefined;
    }
    const m = messaging();
    const token = await m.getToken();
    if (token) {
      current = token;
      await send(token);
    }
    return m.onTokenRefresh((t) => {
      current = t;
      void send(t);
    });
  } catch {
    return () => undefined;
  }
}

/** Logout se pehle: is phone par is account ki push band */
export async function unregisterPush(): Promise<void> {
  try {
    if (current) await api('/me/devices', { method: 'DELETE', body: { token: current } }).catch(() => undefined);
    current = null;
    await loadMessaging()?.().deleteToken().catch(() => undefined);
  } catch {
    /* ignore */
  }
}
