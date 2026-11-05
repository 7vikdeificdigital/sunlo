import { Ionicons } from '@expo/vector-icons';
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus, useAudioRecorder } from 'expo-audio';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/ui';
import { mmss } from '@/lib/voice';
import { colors, radius, shadow, space } from '@/theme';

const BARS = 32;
function barHeights(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  const out: number[] = [];
  for (let i = 0; i < BARS; i++) {
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    const r = ((h >>> 0) % 1000) / 1000;
    const env = 0.45 + 0.55 * Math.sin((Math.PI * (i + 1)) / (BARS + 1)); // beech mein unchi, kinaron par chhoti
    out.push(6 + Math.round(18 * Math.min(1, r * 0.7 + env * 0.5)));
  }
  return out;
}

/** Waveform wala audio player: play/pause, progress, time, waveform par tap karke aage-peeche */
export function VoicePlayer({ uri, durationSec }: { uri: string; durationSec?: number }) {
  const player = useAudioPlayer({ uri });
  const st = useAudioPlayerStatus(player);
  const [w, setW] = useState(0);
  const bars = useMemo(() => barHeights(uri), [uri]);
  useEffect(() => {
    if (st.didJustFinish) void player.seekTo(0);
  }, [st.didJustFinish, player]);
  const total = st.duration > 0 ? st.duration : (durationSec ?? 0);
  const progress = total > 0 ? Math.min(1, st.currentTime / total) : 0;
  const filled = Math.round(progress * BARS);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.surfaceAlt, borderRadius: radius.lg, paddingVertical: 10, paddingLeft: 10, paddingRight: 14 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={st.playing ? 'Pause' : 'Play'}
        onPress={() => {
          void setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
          if (st.playing) player.pause();
          else player.play();
        }}
        style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.85 : 1, ...shadow.card })}
      >
        <Ionicons name={st.playing ? 'pause' : 'play'} size={20} color={colors.white} style={st.playing ? undefined : { marginLeft: 2 }} />
      </Pressable>
      <View style={{ flex: 1, gap: 4 }}>
        <Pressable
          onLayout={(e) => setW(e.nativeEvent.layout.width)}
          onPress={(e) => {
            if (w > 0 && total > 0) void player.seekTo((e.nativeEvent.locationX / w) * total);
          }}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 28 }}
        >
          {bars.map((h, i) => (
            <View key={i} style={{ width: 3, height: h, borderRadius: 2, backgroundColor: i < filled ? colors.primary : colors.primaryTint }} />
          ))}
        </Pressable>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text raw variant="caption">{mmss(st.currentTime)}</Text>
          <Text raw variant="caption">{mmss(total)}</Text>
        </View>
      </View>
    </View>
  );
}

/** Mic se record: record -> stop -> sun kar dekho -> dobara / bhejo. onReady(uri, sec) ya onClear() */
export function VoiceRecorder({ maxSec = 60, onReady, onClear }: { maxSec?: number; onReady: (uri: string, sec: number) => void; onClear: () => void }) {
  const rec = useAudioRecorder(RecordingPresets.LOW_QUALITY);
  const [state, setState] = useState<'idle' | 'rec' | 'done'>('idle');
  const [sec, setSec] = useState(0);
  const [uri, setUri] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const t0 = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  async function start() {
    setErr(null);
    try {
      const p = await requestRecordingPermissionsAsync();
      if (!p.granted) return setErr('Mic ki anumati chahiye. Settings mein allow karein.');
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await rec.prepareToRecordAsync();
      rec.record();
      t0.current = Date.now();
      setSec(0);
      setState('rec');
      timer.current = setInterval(() => {
        const s = (Date.now() - t0.current) / 1000;
        setSec(s);
        if (s >= maxSec) void stop();
      }, 250);
    } catch {
      setErr('Recording shuru nahi ho paayi');
    }
  }

  async function stop() {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    const s = (Date.now() - t0.current) / 1000;
    try {
      await rec.stop();
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      const u = rec.uri;
      if (!u || s < 1) {
        setState('idle');
        return setErr('Recording bahut chhoti thi, dobara bolein');
      }
      setUri(u);
      setSec(s);
      setState('done');
      onReady(u, s);
    } catch {
      setState('idle');
      setErr('Recording save nahi ho paayi');
    }
  }

  function reset() {
    setUri(null);
    setSec(0);
    setState('idle');
    onClear();
  }

  return (
    <View style={{ gap: space.sm }}>
      {state === 'done' && uri ? (
        <View style={{ gap: space.sm }}>
          <VoicePlayer uri={uri} durationSec={sec} />
          <Pressable onPress={reset} style={{ alignSelf: 'flex-start' }}>
            <Text variant="small" color={colors.danger}>Dobara record karein</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          accessibilityLabel={state === 'rec' ? 'Recording rokein' : 'Recording shuru karein'}
          onPress={state === 'rec' ? stop : start}
          style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: state === 'rec' ? colors.dangerSoft : colors.primarySoft, borderRadius: radius.pill, padding: 10 }}
        >
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: state === 'rec' ? colors.danger : colors.primary, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={state === 'rec' ? 'stop' : 'mic'} size={22} color={colors.white} />
          </View>
          <Text variant="bodyStrong">{state === 'rec' ? `Record ho raha hai  ${mmss(sec)} / ${mmss(maxSec)}` : 'Mic dabakar bolna shuru karein'}</Text>
        </Pressable>
      )}
      {err ? <Text variant="small" color={colors.danger}>{err}</Text> : null}
    </View>
  );
}
