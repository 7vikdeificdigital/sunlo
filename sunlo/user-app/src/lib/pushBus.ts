/** Push aane par app ke andar banner dikhane ke liye chhota event-bus (FCM foreground mein khud kuch nahi dikhata) */
export type PushMsg = {
  title: string;
  body: string;
  /** Banner par ek button (jaise "Recharge karein") */
  action?: { label: string; href: string };
  /** 'alert' = laal/zaroori (jaise balance khatam hone wala hai) */
  tone?: 'info' | 'alert';
  /** Itne second tak dikhe (default 4) */
  seconds?: number;
  /** Banner par tap karne par is screen par le jao */
  href?: string;
};
type Cb = (m: PushMsg) => void;

const listeners = new Set<Cb>();

export function onPushMessage(cb: Cb): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function emitPushMessage(m: PushMsg): void {
  listeners.forEach((cb) => cb(m));
}
