import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = '';
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH) as unknown as number[]);
  return btoa(bin);
}

const cache = new Map<string, string>();

/** Transparent WebM (VP9 alpha) gift animation: poori screen par ek baar chalti hai, khatam hone par onDone */
export function WebmView({ url, onDone, onFail }: { url: string; onDone: () => void; onFail: () => void }) {
  const [b64, setB64] = useState<string | null>(cache.get(url) ?? null);
  const started = useRef(false);

  useEffect(() => {
    let dead = false;
    if (cache.has(url)) return;
    fetch(url)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error('http'))))
      .then((buf) => {
        const s = toBase64(buf);
        // Cache chhota rakho (max 6 animation), warna memory bhar jaati hai
        if (cache.size >= 6) cache.delete(cache.keys().next().value as string);
        cache.set(url, s);
        if (!dead) setB64(s);
      })
      .catch(() => !dead && onFail());
    return () => {
      dead = true;
    };
  }, [url, onFail]);

  // Safety: atak jaye to 8 second baad hat jaye; 5 second mein shuru na ho to emoji wala animation
  useEffect(() => {
    const t = setTimeout(onDone, 8_000);
    const w = setTimeout(() => !started.current && onFail(), 5_000);
    return () => {
      clearTimeout(t);
      clearTimeout(w);
    };
  }, [onDone, onFail]);

  const html = useMemo(() => {
    if (!b64) return null;
    return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<style>html,body{margin:0;padding:0;background:transparent;width:100%;height:100%;overflow:hidden}
video{position:absolute;left:0;top:0;width:100%;height:100%;object-fit:cover;background:transparent}</style></head>
<body><video id="v" muted playsinline autoplay src="data:video/webm;base64,${b64}"></video>
<script>
var v=document.getElementById('v');
function post(m){window.ReactNativeWebView.postMessage(m)}
v.addEventListener('ended',function(){post('done')});
v.addEventListener('error',function(){post('error')});
v.addEventListener('playing',function(){post('started')});
var p=v.play();if(p&&p.catch)p.catch(function(){post('error')});
</script></body></html>`;
  }, [b64]);

  if (!html) return null;
  return (
    <WebView
      pointerEvents="none"
      originWhitelist={['*']}
      source={{ html }}
      style={StyleSheet.absoluteFill}
      containerStyle={{ backgroundColor: 'transparent' }}
      androidLayerType="hardware"
      javaScriptEnabled
      mediaPlaybackRequiresUserAction={false}
      allowsInlineMediaPlayback
      onMessage={(e) => {
        const m = e.nativeEvent.data;
        if (m === 'started') started.current = true;
        else if (m === 'done') onDone();
        else if (m === 'error') onFail();
      }}
      onError={onFail}
      backgroundColor="transparent"
      scrollEnabled={false}
    />
  );
}
