import { useEffect, useMemo, useState } from 'react';
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
export function SvgaView({ url, onDone }: { url: string; onDone: () => void }) {
  const [b64, setB64] = useState<string | null>(cache.get(url) ?? null);

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
      .catch(() => !dead && onDone());
    return () => {
      dead = true;
    };
  }, [url, onDone]);

  // Safety: animation atak jaye to 12 second baad apne aap hat jaye
  useEffect(() => {
    const t = setTimeout(onDone, 12_000);
    return () => clearTimeout(t);
  }, [onDone]);

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
        if (e.nativeEvent.data === 'done' || e.nativeEvent.data === 'error') onDone();
      }}
      onError={onDone}
      backgroundColor="transparent"
      scrollEnabled={false}
    />
  );
}
