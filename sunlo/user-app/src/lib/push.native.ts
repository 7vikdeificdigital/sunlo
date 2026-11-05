import { PermissionsAndroid, Platform } from 'react-native';
import { api } from './api';
import { emitPushMessage } from './pushBus';

/**
 * @react-native-firebase v22+ mein purana messaging() (default export) hata diya gaya hai;
 * ab sirf modular functions hain: getMessaging, getToken, onTokenRefresh, onMessage, deleteToken.
 */
type Messaging = unknown;
type Remote = { notification?: { title?: string; body?: string } };
type Fcm = {
  getMessaging: () => Messaging;
  getToken: (m: Messaging) => Promise<string>;
  deleteToken: (m: Messaging) => Promise<void>;
  onTokenRefresh: (m: Messaging, cb: (t: string) => void) => () => void;
  onMessage: (m: Messaging, cb: (msg: Remote) => void) => () => void;
};

let current: string | null = null;

/** Firebase Cloud Messaging module juda hai to usse, warna null (Expo Go / purani build mein push nahi chalegi, app chalti rahegi) */
function loadMessaging(): Fcm | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const m = require('@react-native-firebase/messaging') as Partial<Fcm>;
    return typeof m.getMessaging === 'function' && typeof m.getToken === 'function' ? (m as Fcm) : null;
  } catch {
    return null;
  }
}

const send = (token: string) => api('/me/devices', { method: 'POST', body: { token, platform: Platform.OS === 'ios' ? 'ios' : 'android' } }).catch(() => undefined);

/** Login ke baad: notification ki anumati, FCM token server ko, token badle to naya bhi, aur app khuli ho to banner. Cleanup function lautata hai. */
export async function registerPush(): Promise<() => void> {
  try {
    const fcm = loadMessaging();
    if (!fcm) return () => undefined;
    if (Platform.OS === 'android' && Number(Platform.Version) >= 33) {
      const r = await PermissionsAndroid.request('android.permission.POST_NOTIFICATIONS' as never);
      if (r !== PermissionsAndroid.RESULTS.GRANTED) return () => undefined;
    }
    const m = fcm.getMessaging();
    const token = await fcm.getToken(m);
    if (token) {
      current = token;
      await send(token);
    }
    const offToken = fcm.onTokenRefresh(m, (t) => {
      current = t;
      void send(t);
    });
    // App khuli (foreground) ho to Android khud notification nahi dikhata; isliye app ke andar banner
    const offMsg = fcm.onMessage(m, (rm) => {
      const n = rm.notification;
      if (n?.title || n?.body) emitPushMessage({ title: n.title ?? '', body: n.body ?? '' });
    });
    return () => {
      offToken();
      offMsg();
    };
  } catch {
    return () => undefined;
  }
}

/** Logout se pehle: is phone par is account ki push band */
export async function unregisterPush(): Promise<void> {
  try {
    if (current) await api('/me/devices', { method: 'DELETE', body: { token: current } }).catch(() => undefined);
    current = null;
    const fcm = loadMessaging();
    if (fcm) await fcm.deleteToken(fcm.getMessaging()).catch(() => undefined);
  } catch {
    /* ignore */
  }
}
