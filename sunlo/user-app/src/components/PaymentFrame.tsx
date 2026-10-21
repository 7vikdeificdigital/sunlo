import { createElement, useEffect } from 'react';

/** Web preview ke liye: payment page iframe mein, nateeja window.postMessage se */
export function PaymentFrame({ url, onMessage }: { url: string; onMessage: (data: string) => void }) {
  useEffect(() => {
    const origin = new URL(url).origin;
    const h = (e: MessageEvent) => {
      if (e.origin === origin && typeof e.data === 'string') onMessage(e.data);
    };
    window.addEventListener('message', h);
    return () => window.removeEventListener('message', h);
  }, [url, onMessage]);
  return createElement('iframe', { src: url, style: { flex: 1, border: 0, width: '100%', height: '100%' }, title: 'Payment' });
}
