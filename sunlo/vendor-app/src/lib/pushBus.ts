/** Push aane par app ke andar banner dikhane ke liye chhota event-bus (FCM foreground mein khud kuch nahi dikhata) */
export type PushMsg = { title: string; body: string };
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
