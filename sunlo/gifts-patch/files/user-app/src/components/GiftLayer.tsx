import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { usePathname } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Modal, Pressable, ScrollView, StyleSheet, Vibration, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_URL, api, errorMessage } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { colors } from '@/theme';
import { Coin, CoinPrice } from './Coin';
import { SvgaView } from './SvgaView';
import { Text } from './ui';
import { WebmView } from './WebmView';

type Media = 'svga' | 'webm' | null;
type Gift = { id: string; name: string; icon: string; price: number; svgaUrl: string | null; mediaType: Media; thumbUrl: string | null };
type GiftEvent = Gift & { sessionId: string; giftId?: string; from: string };
type Anim = { key: number; icon: string; title: string; sub: string | null; coins: number | null; mediaUrl: string | null; mediaType: Media; thumbUrl: string | null; big: boolean; epic: boolean; small: boolean };
type SessionLite = { status?: string; acceptedAt?: string | null };

/** 500 coin (₹500) se chhote gifts chhote dikhte hain, bade gifts poori screen par */
const EPIC_PAISE = 50000;
const full = (u: string | null) => (u ? `${API_URL}${u}` : null);

/** /call/<id> ya /session/<id> screen par ho to session id */
function sessionIdFrom(path: string): string | null {
  const m = path.match(/\/(?:call|session)\/([0-9a-f-]{36})/i);
  return m ? m[1]! : null;
}

function EmojiBurst({ anim, onDone }: { anim: Anim; onDone: () => void }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(t, { toValue: 1, duration: anim.big ? 3200 : 2400, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(onDone);
  }, [t, onDone, anim.big]);
  const scale = t.interpolate({ inputRange: [0, 0.2, 0.7, 1], outputRange: [0.2, 1.25, 1, 0.9] });
  const opacity = t.interpolate({ inputRange: [0, 0.1, 0.8, 1], outputRange: [0, 1, 1, 0] });
  const rise = t.interpolate({ inputRange: [0, 1], outputRange: [60, -120] });
  const spread = [-1, -0.5, 0, 0.5, 1];
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
      <Animated.Text style={{ fontSize: anim.big ? 120 : 84, opacity, transform: [{ scale }, { translateY: rise }] }}>{anim.icon}</Animated.Text>
      {anim.big
        ? spread.map((x, i) => (
            <Animated.Text
              key={i}
              style={{ position: 'absolute', fontSize: 34, opacity, transform: [{ translateX: x * 130 }, { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [40 + i * 10, -220 - i * 25] }) }, { scale }] }}
            >
              {anim.icon}
            </Animated.Text>
          ))
        : null}
    </View>
  );
}

/** Mehengi gifts par chamakti hui sparkle barsaat (sirf RN Animated, koi extra package nahi) */
function Sparkles() {
  const items = useRef(
    Array.from({ length: 14 }, (_, i) => ({
      v: new Animated.Value(0),
      left: 4 + ((i * 37) % 92),
      size: 14 + ((i * 7) % 16),
      delay: (i * 190) % 1900,
      dur: 1800 + ((i * 130) % 1200),
    })),
  ).current;
  useEffect(() => {
    items.forEach((s) => {
      Animated.loop(Animated.sequence([Animated.delay(s.delay), Animated.timing(s.v, { toValue: 1, duration: s.dur, easing: Easing.out(Easing.quad), useNativeDriver: true }), Animated.timing(s.v, { toValue: 0, duration: 0, useNativeDriver: true })])).start();
    });
    return () => items.forEach((s) => s.v.stopAnimation());
  }, [items]);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {items.map((s, i) => (
        <Animated.Text
          key={i}
          style={{
            position: 'absolute',
            left: `${s.left}%`,
            bottom: 40,
            fontSize: s.size,
            opacity: s.v.interpolate({ inputRange: [0, 0.15, 0.8, 1], outputRange: [0, 1, 0.9, 0] }),
            transform: [{ translateY: s.v.interpolate({ inputRange: [0, 1], outputRange: [0, -420 - s.size * 6] }) }, { rotate: s.v.interpolate({ inputRange: [0, 1], outputRange: ['0deg', i % 2 ? '60deg' : '-60deg'] }) }],
          }}
        >
          ✨
        </Animated.Text>
      ))}
    </View>
  );
}

function Overlay({ anim, onDone, top }: { anim: Anim; onDone: () => void; top: number }) {
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(-90)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 280, useNativeDriver: true }).start();
    Animated.spring(slide, { toValue: 0, friction: 7, tension: 70, useNativeDriver: true }).start();
    Animated.loop(Animated.sequence([Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }), Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: true })])).start();
    if (anim.big) Vibration.vibrate(anim.epic ? [0, 40, 60, 40] : 30);
    return () => pulse.stopAnimation();
  }, [fade, slide, pulse, anim.big, anim.epic]);
  const glowScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.08] });
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { zIndex: 50 }]}>
      {anim.big && !anim.small ? (
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: fade, backgroundColor: 'rgba(4,14,13,0.45)', alignItems: 'center', justifyContent: 'center' }]}>
          <Animated.View style={{ width: 380, height: 380, borderRadius: 190, backgroundColor: 'rgba(21,192,174,0.14)', transform: [{ scale: glowScale }], alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: 270, height: 270, borderRadius: 135, backgroundColor: 'rgba(255,122,89,0.14)' }} />
          </Animated.View>
        </Animated.View>
      ) : null}

      <View pointerEvents="none" style={anim.small && anim.mediaUrl ? { position: 'absolute', alignSelf: 'center', bottom: 150, width: '52%', aspectRatio: 9 / 16 } : StyleSheet.absoluteFill}>
        {anim.mediaUrl && anim.mediaType === 'webm' ? <WebmView url={anim.mediaUrl} onDone={onDone} /> : null}
        {anim.mediaUrl && anim.mediaType === 'svga' ? <SvgaView url={anim.mediaUrl} onDone={onDone} /> : null}
      </View>
      {!anim.mediaUrl ? <EmojiBurst anim={anim} onDone={onDone} /> : null}
      {anim.epic ? <Sparkles /> : null}

      <Animated.View style={{ position: 'absolute', top, left: 16, right: 16, alignItems: 'center', opacity: fade, transform: [{ translateY: slide }] }}>
        <LinearGradient colors={['rgba(14,36,33,0.94)', 'rgba(24,70,64,0.94)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingLeft: 8, paddingRight: 18, borderRadius: 32, borderWidth: 1, borderColor: 'rgba(94,230,210,0.45)' }}>
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            {anim.thumbUrl ? <Image source={{ uri: anim.thumbUrl }} style={{ width: 40, height: 40 }} resizeMode="contain" /> : <Text style={{ fontSize: 24 }}>{anim.icon}</Text>}
          </View>
          <View style={{ gap: 1 }}>
            <Text style={{ color: colors.white, fontSize: 14 }} numberOfLines={1}>{anim.title}</Text>
            {anim.coins !== null ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Coin size={13} />
                <Text style={{ color: '#7FE9D8', fontSize: 11.5 }}>{anim.coins.toLocaleString('en-IN')} {anim.sub}</Text>
              </View>
            ) : null}
          </View>
        </LinearGradient>
      </Animated.View>
    </View>
  );
}

/**
 * Gift system ka poora UI:
 *  - 3D gift animation (transparent WebM / SVGA / emoji) + sender banner + glow + sparkles (dono taraf)
 *  - Har poora minute hone par chhota celebration
 *  - User ko call/chat screen par gift button + 3D gift sheet (role='user')
 * `(app)/_layout.tsx` mein ek baar lagta hai.
 */
export function GiftLayer({ role }: { role: 'user' | 'vendor' }) {
  const path = usePathname();
  const sid = sessionIdFrom(path);
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  const [queue, setQueue] = useState<Anim[]>([]);
  const [sheet, setSheet] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const seq = useRef(0);
  const lastMinute = useRef<{ id: string; m: number } | null>(null);
  const btnPulse = useRef(new Animated.Value(0)).current;

  const push = useCallback((a: Omit<Anim, 'key'>) => setQueue((q) => [...q, { ...a, key: ++seq.current }]), []);

  // Gift aane par animation (user aur vendor dono ke liye)
  useEffect(() => {
    const s = getSocket();
    const seen = new Set<string>();
    const on = (e: GiftEvent) => {
      const k = `${e.sessionId}:${e.giftId}:${Math.floor(Date.now() / 2000)}`; // session room + user room se double event na chale
      if (seen.has(k)) return;
      seen.add(k);
      push({
        icon: e.icon,
        mediaUrl: full(e.svgaUrl),
        mediaType: e.mediaType ?? null,
        thumbUrl: full(e.thumbUrl),
        title: role === 'vendor' ? `${e.from} ne ${e.name} bheja` : `Aapne ${e.name} bheja`,
        sub: role === 'vendor' ? 'coins ka gift mila' : 'coins',
        coins: Math.round(e.price / 100),
        big: true,
        epic: e.price >= EPIC_PAISE,
        small: e.price < EPIC_PAISE,
      });
      // Wallet, kamai, history sab taaza (gifts ka catalog chhod kar)
      void qc.invalidateQueries({ predicate: (q) => q.queryKey[0] !== 'gifts' && q.queryKey[0] !== 'session' });
    };
    s.on('gift', on);
    return () => {
      s.off('gift', on);
    };
  }, [push, qc, role]);

  // Har poora minute hone par chhota celebration
  useEffect(() => {
    if (!sid) return;
    const t = setInterval(() => {
      const d = qc.getQueryData<SessionLite>(['session', sid]);
      if (d?.status !== 'ACTIVE' || !d.acceptedAt) return;
      const m = Math.floor((Date.now() - new Date(d.acceptedAt).getTime()) / 60000);
      if (m < 1) return;
      if (lastMinute.current?.id !== sid) lastMinute.current = { id: sid, m: m - 1 };
      if (m > lastMinute.current.m) {
        lastMinute.current.m = m;
        push({ icon: '🎉', mediaUrl: null, mediaType: null, thumbUrl: null, title: `${m} minute poore ho gaye`, sub: null, coins: null, big: false, epic: false, small: false });
      }
    }, 1000);
    return () => clearInterval(t);
  }, [sid, qc, push]);

  const gifts = useQuery({ queryKey: ['gifts'], queryFn: () => api<{ items: Gift[] }>('/gifts'), enabled: role === 'user' && !!sid, staleTime: 60_000 });
  // Session query ko subscribe karte hain, taaki ACTIVE hote hi button dikhe (cache badalne par re-render)
  const sessionQ = useQuery({ queryKey: ['session', sid ?? 'none'], queryFn: () => api<SessionLite>(`/sessions/${sid}`), enabled: !!sid, staleTime: 5000 });
  const session = sid ? sessionQ.data : undefined;
  const canGift = role === 'user' && !!sid && session?.status === 'ACTIVE';

  useEffect(() => {
    if (!canGift) return;
    const l = Animated.loop(Animated.sequence([Animated.timing(btnPulse, { toValue: 1, duration: 1100, useNativeDriver: true }), Animated.timing(btnPulse, { toValue: 0, duration: 1100, useNativeDriver: true })]));
    l.start();
    return () => l.stop();
  }, [canGift, btnPulse]);

  const pickedGift = gifts.data?.items.find((g) => g.id === picked) ?? null;

  async function send() {
    if (!sid || sending || !pickedGift) return;
    setSending(true);
    setMsg(null);
    try {
      await api(`/sessions/${sid}/gifts`, { method: 'POST', body: { giftId: pickedGift.id } });
      setSheet(false);
      setPicked(null);
    } catch (e) {
      setMsg(errorMessage(e));
    } finally {
      setSending(false);
    }
  }

  const cur = queue[0];
  const done = useCallback(() => setQueue((q) => q.slice(1)), []);

  return (
    <>
      {canGift ? (
        <Pressable
          accessibilityLabel="Gift bhejein"
          onPress={() => {
            setMsg(null);
            setSheet(true);
          }}
          style={{ position: 'absolute', right: 16, top: insets.top + 64, width: 52, height: 52, alignItems: 'center', justifyContent: 'center' }}
        >
          <Animated.View style={{ position: 'absolute', width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,122,89,0.45)', opacity: btnPulse.interpolate({ inputRange: [0, 1], outputRange: [0.8, 0] }), transform: [{ scale: btnPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.7] }) }] }} />
          <LinearGradient colors={['#FF9A6B', '#FF5E7E']} style={{ width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', elevation: 8 }}>
            <Ionicons name="gift" size={22} color={colors.white} />
          </LinearGradient>
        </Pressable>
      ) : null}

      {cur ? <Overlay key={cur.key} anim={cur} onDone={done} top={insets.top + 70} /> : null}

      <Modal visible={sheet} transparent animationType="slide" onRequestClose={() => setSheet(false)} statusBarTranslucent>
        <Pressable onPress={() => setSheet(false)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}>
          <Pressable onPress={() => undefined}>
            <LinearGradient colors={['#12302C', '#0A1B19']} style={{ borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 10, paddingHorizontal: 16, paddingBottom: 16 + insets.bottom, borderTopWidth: 1, borderColor: 'rgba(94,230,210,0.25)' }}>
              <View style={{ alignSelf: 'center', width: 42, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)', marginBottom: 12 }} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Ionicons name="gift" size={20} color="#FF9A6B" />
                <Text style={{ color: colors.white, fontSize: 18 }}>Gift bhejein</Text>
              </View>
              <Text style={{ color: '#8FB1AC', fontSize: 12.5, marginBottom: 12 }}>Aapke wallet se coins katenge. Jo gift chuna hai, wahi neeche button par dikhega.</Text>
              {msg ? (
                <View style={{ backgroundColor: 'rgba(214,69,69,0.18)', borderRadius: 12, padding: 10, marginBottom: 10 }}>
                  <Text style={{ color: '#FF9C9C', fontSize: 12.5 }}>{msg}</Text>
                </View>
              ) : null}
              <ScrollView style={{ maxHeight: 360 }} contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingBottom: 6 }}>
                {(gifts.data?.items ?? []).map((g) => {
                  const on = picked === g.id;
                  return (
                    <Pressable
                      key={g.id}
                      onPress={() => setPicked(g.id)}
                      style={{
                        width: '31.3%',
                        alignItems: 'center',
                        gap: 4,
                        paddingTop: 10,
                        paddingBottom: 8,
                        borderRadius: 18,
                        backgroundColor: on ? 'rgba(21,192,174,0.20)' : 'rgba(255,255,255,0.05)',
                        borderWidth: 1.5,
                        borderColor: on ? '#5EE6D2' : 'rgba(255,255,255,0.08)',
                      }}
                    >
                      {g.thumbUrl ? <Image source={{ uri: full(g.thumbUrl)! }} style={{ width: 62, height: 62 }} resizeMode="contain" /> : <Text style={{ fontSize: 40, height: 62, lineHeight: 62 }}>{g.icon}</Text>}
                      <Text style={{ color: colors.white, fontSize: 12.5 }} numberOfLines={1}>{g.name}</Text>
                      <View style={{ paddingHorizontal: 9, paddingVertical: 2, borderRadius: 10, backgroundColor: on ? '#5EE6D2' : 'rgba(255,200,87,0.16)' }}>
                        <CoinPrice paise={g.price} size={11.5} color={on ? '#04201D' : '#FFC857'} />
                      </View>
                    </Pressable>
                  );
                })}
                {gifts.isLoading ? <Text style={{ color: '#8FB1AC' }}>Gifts load ho rahe hain...</Text> : null}
                {!gifts.isLoading && !gifts.data?.items.length ? <Text style={{ color: '#8FB1AC' }}>Abhi koi gift available nahi hai.</Text> : null}
              </ScrollView>
              <Pressable onPress={send} disabled={!pickedGift || sending} style={{ marginTop: 12, opacity: !pickedGift || sending ? 0.5 : 1 }}>
                <LinearGradient colors={['#FF9A6B', '#FF5E7E']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}>
                  <Ionicons name="paper-plane" size={18} color={colors.white} />
                  <Text style={{ color: colors.white, fontSize: 15 }}>{sending ? 'Bhej rahe hain...' : pickedGift ? `${pickedGift.name} bhejein ·` : 'Pehle gift chunein'}</Text>
                  {pickedGift && !sending ? <CoinPrice paise={pickedGift.price} size={15} color={colors.white} /> : null}
                </LinearGradient>
              </Pressable>
            </LinearGradient>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
