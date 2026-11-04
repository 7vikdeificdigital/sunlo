import { api } from './api';

type Purchase = { productId: string; purchaseToken?: string | null };
type Iap = {
  initConnection: () => Promise<boolean>;
  fetchProducts: (a: { skus: string[]; type?: 'in-app' | 'subs' | 'all' }) => Promise<unknown[] | null | undefined>;
  requestPurchase: (a: unknown) => Promise<unknown>;
  finishTransaction: (a: { purchase: Purchase; isConsumable?: boolean }) => Promise<unknown>;
  getAvailablePurchases: () => Promise<Purchase[]>;
  purchaseUpdatedListener: (cb: (p: Purchase) => void) => { remove: () => void };
  purchaseErrorListener: (cb: (e: { code?: string; message?: string }) => void) => { remove: () => void };
};

let mod: Iap | null | undefined;
/** expo-iap native module juda ho to hi (Expo Go / purani build mein null) */
function iap(): Iap | null {
  if (mod === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      mod = require('expo-iap') as Iap;
    } catch {
      mod = null;
    }
  }
  return mod;
}

let connected = false;
async function connect(m: Iap) {
  if (!connected) {
    await m.initConnection();
    connected = true;
  }
}

/** Server se purchase verify; PAID hone par hi Google ko "consume" bolte hain (taaki wahi pack dobara kharida ja sake) */
async function settle(m: Iap, p: Purchase): Promise<'PAID' | 'PENDING'> {
  if (!p.purchaseToken) return 'PENDING';
  const r = await api<{ status: 'PAID' | 'PENDING' }>('/wallet/play/verify', { method: 'POST', body: { productId: p.productId, purchaseToken: p.purchaseToken } });
  if (r.status === 'PAID') await m.finishTransaction({ purchase: p, isConsumable: true });
  return r.status;
}

/** Ek coin pack kharidna. Google ka payment sheet khulta hai; server verify karke coins jodta hai. */
export async function buyCoins(productId: string, userId: string): Promise<{ status: 'PAID' | 'PENDING' }> {
  const m = iap();
  if (!m) throw new Error('Is build mein Play Billing nahi hai');
  await connect(m);
  const found = await m.fetchProducts({ skus: [productId], type: 'in-app' });
  if (!found || found.length === 0) throw new Error('Yeh pack Play Store par abhi available nahi hai');

  return new Promise((resolve, reject) => {
    let done = false;
    const finish = (fn: () => void) => {
      if (done) return;
      done = true;
      upd.remove();
      err.remove();
      fn();
    };
    const upd = m.purchaseUpdatedListener((p) => {
      if (p.productId !== productId) return;
      settle(m, p).then((s) => finish(() => resolve({ status: s })), (e) => finish(() => reject(e)));
    });
    const err = m.purchaseErrorListener((e) => finish(() => reject(new Error(e.code === 'user-cancelled' ? 'Payment cancel kar diya' : (e.message ?? 'Payment poora nahi hua')))));
    m.requestPurchase({ request: { google: { skus: [productId], obfuscatedAccountId: userId } }, type: 'in-app' }).catch((e) => finish(() => reject(e)));
  });
}

/** App band/crash ke beech adhoori rahi purchases ko dobara server se settle karna. Kitni settle hui, wo lautata hai. */
export async function recoverPurchases(): Promise<number> {
  const m = iap();
  if (!m) return 0;
  try {
    await connect(m);
    const list = await m.getAvailablePurchases();
    let n = 0;
    for (const p of list ?? []) {
      if (!/^coins_\d+$/.test(p.productId)) continue;
      if ((await settle(m, p).catch(() => 'PENDING')) === 'PAID') n++;
    }
    return n;
  } catch {
    return 0;
  }
}
