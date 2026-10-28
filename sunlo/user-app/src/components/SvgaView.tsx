import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { JSZIP_LIB, SVGA_LIB } from './svgaLib';

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = '';
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH) as unknown as number[]);
  return btoa(bin);
}

const cache = new Map<string, string>();

/** SVGA 1.x = ZIP ('PK'), 2.x = zlib. Player ko sahi version ka prefix chahiye */
function svgaPrefix(buf: ArrayBuffer): string {
  const b = new Uint8Array(buf, 0, 2);
  return b[0] === 0x50 && b[1] === 0x4b ? 'data:svga/1.0;base64,' : 'data:svga/2.0;base64,';
}

/** Poori screen par ek baar SVGA animation chalata hai; khatam (ya error) par onDone */
export function SvgaView({ url, onDone, onFail }: { url: string; onDone: () => void; onFail: () => void }) {
  const [b64, setB64] = useState<string | null>(cache.get(url) ?? null);
  const started = useRef(false);

  useEffect(() => {
    let dead = false;
    if (cache.has(url)) return;
    fetch(url)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error('http'))))
      .then((buf) => {
        const s = svgaPrefix(buf) + toBase64(buf);
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
#c{position:absolute;left:0;top:0;width:100%;height:100%}</style></head>
<body><div id="c"></div><script>window.JSZipUtils={getBinaryContent:function(u,cb){var x=new XMLHttpRequest();x.open('GET',u,true);x.responseType='arraybuffer';x.onload=function(){cb(null,x.response)};x.onerror=function(){cb(new Error('net'))};x.send()}};</script><script>${JSZIP_LIB}</script><script>${SVGA_LIB}</script>
<script>
function post(m){window.ReactNativeWebView.postMessage(m)}
try{
  var player=new SVGA.Player('#c');var parser=new SVGA.Parser('#c');
  player.loops=1;player.clearsAfterStop=true;player.setContentMode('AspectFit');
  player.onFinished(function(){post('done')});
  parser.load('${b64}',function(v){player.setVideoItem(v);player.startAnimation();post('started')},function(){post('error')});
}catch(e){post('error')}
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
