import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, View } from 'react-native';
import { FloatingFaces } from '@/components/FloatingFaces';
import { LogoMark } from '@/components/Logo';
import { Button, Screen, Text } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { TYPE_META } from '@/lib/randomConnect';
import type { Session, SessionType } from '@/lib/types';
import { colors, font, radius, space } from '@/theme';

const MAX_TRIES = 6; // itne alag listeners ko try karenge
const PATIENCE_MS = 20_000; // har listener ko itna samay (accept karne ke liye)
const TIPS = ['Pehle ek pyaara "Namaste" bol kar baat shuru karein', 'Dil khol kar baat karein, yahan koi judge nahi karta', 'Paisa sirf baat ke minute ka katta hai', 'Kuch galat lage to End ya Report kar sakte hain'];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const DONE_STATES = ['REJECTED', 'MISSED', 'CANCELLED', 'COMPLETED'];

type Phase = 'searching' | 'none' | 'poor' | 'error';

function Rings() {
  const vals = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;
  useEffect(() => {
    const loops = vals.map((v, i) => {
      const l = Animated.loop(Animated.sequence([Animated.delay(i * 650), Animated.timing(v, { toValue: 1, duration: 2000, easing: Easing.out(Easing.quad), useNativeDriver: true }), Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: true })]));
      l.start();
      return l;
    });
    return () => loops.forEach((l) => l.stop());
  }, [vals]);
  return (
    <View style={{ width: 300, height: 300, alignItems: 'center', justifyContent: 'center' }}>
      <FloatingFaces width={300} height={300} />
      {vals.map((v, i) => (
        <Animated.View
          key={i}
          style={{ position: 'absolute', width: 120, height: 120, borderRadius: 60, borderWidth: 2, borderColor: 'rgba(123,92,255,0.7)', opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.8, 0] }), transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.8, 2.1] }) }] }}
        />
      ))}
      <View style={{ width: 104, height: 104, borderRadius: 34, backgroundColor: '#0A0618', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(139,108,255,0.5)' }}>
        <LogoMark size={70} />
      </View>
    </View>
  );
}

export default function Connecting() {
  const { type: rawType } = useLocalSearchParams<{ type: string }>();
  const type: SessionType = rawType === 'AUDIO' || rawType === 'VIDEO' ? rawType : 'CHAT';
  const meta = TYPE_META[type];
  const qc = useQueryClient();
  const [phase, setPhase] = useState<Phase>('searching');
  const [tries, setTries] = useState(1);
  const [msg, setMsg] = useState('');
  const [tip, setTip] = useState(0);
  const alive = useRef(true);
  const connected = useRef(false);
  const currentId = useRef<string | null>(null);

  const open = useCallback(
    (s: Pick<Session, 'id' | 'type'>) => {
      connected.current = true;
      void qc.invalidateQueries({ queryKey: ['sessions'] });
      router.replace(s.type === 'CHAT' ? `/session/${s.id}` : `/call/${s.id}`);
    },
    [qc],
  );

  const cancelCurrent = useCallback(async () => {
    const id = currentId.current;
    currentId.current = null;
    if (id) await api(`/sessions/${id}/cancel`, { method: 'POST' }).catch(() => undefined);
  }, []);

  /** Ek listener ke jawab ka intezaar: ACTIVE (mil gaya), DECLINED, TIMEOUT ya ABORT */
  const waitFor = useCallback(async (id: string) => {
    const end = Date.now() + PATIENCE_MS;
    while (alive.current && Date.now() < end) {
      await sleep(1500);
      if (!alive.current) break;
      const s = await api<Session>(`/sessions/${id}`).catch(() => null);
      if (s?.status === 'ACTIVE') return 'ACTIVE' as const;
      if (s && DONE_STATES.includes(s.status)) return 'DECLINED' as const;
    }
    return alive.current ? ('TIMEOUT' as const) : ('ABORT' as const);
  }, []);

  const run = useCallback(async () => {
    setPhase('searching');
    setTries(1);
    const exclude: string[] = [];
    for (let attempt = 1; attempt <= MAX_TRIES; attempt++) {
      if (!alive.current) return;
      setTries(attempt);
      let s: Session;
      try {
        s = (await api<{ session: Session }>('/random/connect', { method: 'POST', body: { type, exclude } })).session;
      } catch (e) {
        if (!alive.current) return;
        if (e instanceof ApiError && e.code === 'NO_ONE_AVAILABLE') return setPhase('none');
        if (e instanceof ApiError && e.code === 'INSUFFICIENT_BALANCE') {
          setMsg(e.message);
          return setPhase('poor');
        }
        if (e instanceof ApiError && e.code === 'SESSION_ALREADY_OPEN') {
          const o = await api<{ session: Session | null }>('/sessions/open').catch(() => null);
          if (o?.session) return open(o.session);
        }
        setMsg(e instanceof ApiError ? e.message : 'Kuch gadbad ho gayi. Dobara koshish karein');
        return setPhase('error');
      }
      currentId.current = s.id;
      exclude.push(s.vendorId);
      const r = await waitFor(s.id);
      if (r === 'ACTIVE') return open(s);
      if (r === 'ABORT') return;
      if (r === 'TIMEOUT') {
        // Cancel karne ki koshish; agar beech mein accept ho chuka ho to wahi session le lo
        const c = await api<Session>(`/sessions/${s.id}/cancel`, { method: 'POST' }).catch(() => null);
        if (!c) {
          const cur = await api<Session>(`/sessions/${s.id}`).catch(() => null);
          if (cur?.status === 'ACTIVE') return open(cur);
        }
      }
      currentId.current = null;
    }
    if (alive.current) setPhase('none');
  }, [type, waitFor, open]);

  useEffect(() => {
    alive.current = true;
    void run();
    const t = setInterval(() => setTip((x) => (x + 1) % TIPS.length), 3500);
    return () => {
      alive.current = false;
      clearInterval(t);
      if (!connected.current) void cancelCurrent();
    };
  }, [run, cancelCurrent]);

  async function stop() {
    alive.current = false;
    await cancelCurrent();
    router.back();
  }

  function retry() {
    alive.current = true;
    void run();
  }

  return (
    <LinearGradient colors={['#241A66', '#120C38']} style={{ flex: 1 }}>
      <Screen edges={['top', 'bottom']} style={{ backgroundColor: 'transparent' }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xl, gap: space.lg }}>
          {phase === 'searching' ? (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 7 }}>
                <Ionicons name={meta.icon} size={16} color={colors.white} />
                <Text style={{ fontFamily: font.medium, fontSize: 13, color: colors.white }}>{meta.title}</Text>
              </View>
              <Rings />
              <View style={{ alignItems: 'center', gap: 6 }}>
                <Text style={{ fontFamily: font.bold, fontSize: 21, color: colors.white, textAlign: 'center' }}>Koi sunne wala dhoondh rahe hain...</Text>
                <Text style={{ fontFamily: font.regular, fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>
                  Koshish {tries}/{MAX_TRIES}
                </Text>
              </View>
              <View style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: radius.lg, padding: space.md, minHeight: 56, justifyContent: 'center', maxWidth: 320 }}>
                <Text style={{ fontFamily: font.regular, fontSize: 12.5, lineHeight: 18, color: 'rgba(255,255,255,0.85)', textAlign: 'center' }}>{TIPS[tip]}</Text>
              </View>
            </>
          ) : (
            <>
              <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={phase === 'poor' ? 'wallet-outline' : phase === 'none' ? 'moon-outline' : 'alert-circle-outline'} size={40} color={colors.white} />
              </View>
              <Text style={{ fontFamily: font.bold, fontSize: 21, color: colors.white, textAlign: 'center' }}>
                {phase === 'poor' ? 'Balance kam hai' : phase === 'none' ? 'Abhi koi listener free nahi hai' : 'Kuch gadbad ho gayi'}
              </Text>
              <Text style={{ fontFamily: font.regular, fontSize: 13.5, lineHeight: 20, color: 'rgba(255,255,255,0.75)', textAlign: 'center', maxWidth: 300 }}>
                {phase === 'poor' ? msg || 'Random connect ke liye kam se kam kuch minute ka balance chahiye.' : phase === 'none' ? 'Sab thode busy hain. Thodi der baad dobara try karein, ya Chat/Call tab se kisi ko chunein.' : msg}
              </Text>
            </>
          )}
        </View>

        <View style={{ paddingHorizontal: space.xl, paddingBottom: space.lg, gap: space.sm }}>
          {phase === 'poor' ? <Button title="Wallet recharge karein" icon="wallet" onPress={() => router.replace('/wallet')} /> : null}
          {phase === 'none' || phase === 'error' ? <Button title="Dobara dhoondhein" icon="refresh" onPress={retry} /> : null}
          <Button title={phase === 'searching' ? 'Rok dein' : 'Wapas jayein'} kind={phase === 'searching' ? 'secondary' : 'ghost'} onPress={() => void stop()} />
        </View>
      </Screen>
    </LinearGradient>
  );
}
