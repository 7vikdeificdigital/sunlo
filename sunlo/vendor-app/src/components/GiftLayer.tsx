import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { usePathname } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_URL, api, errorMessage } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { colors, radius, space } from '@/theme';
import { SvgaView } from './SvgaView';
import { Text } from './ui';

type Gift = { id: string; name: string; icon: string; price: number; svgaUrl: string | null };
type GiftEvent = { sessionId: string; name: string; icon: string; price: number; svgaUrl: string | null; from: string };
type Anim = { key: number; icon: string; title: string; svgaUrl: string | null; big: boolean };
type SessionLite = { status?: string; acceptedAt?: string | null };

const rupees = (paise: number) => `₹${(paise / 100).toFixed(paise % 100 ? 2 : 0)}`;

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

/**
 * Gift system ka poora UI:
 *  - SVGA/emoji animation jab gift aaye (dono taraf)
 *  - Har poora minute hone par chhota celebration
 *  - User ko call/chat screen par 🎁 button + gift sheet (role='user')
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
  const [sending, setSending] = useState<string | null>(null);
  const seq = useRef(0);
  const lastMinute = useRef<{ id: string; m: number } | null>(null);

  const push = useCallback((a: Omit<Anim, 'key'>) => setQueue((q) => [...q, { ...a, key: ++seq.current }]), []);

  // Gift aane par animation (user aur vendor dono ke liye)
  useEffect(() => {
    const s = getSocket();
    const seen = new Set<string>();
    const on = (e: GiftEvent & { giftId?: string }) => {
      const k = `${e.sessionId}:${e.giftId}:${Math.floor(Date.now() / 2000)}`; // session room + user room se double event na chale
      if (seen.has(k)) return;
      seen.add(k);
      push({
        icon: e.icon,
        svgaUrl: e.svgaUrl ? `${API_URL}${e.svgaUrl}` : null,
        title: role === 'vendor' ? `${e.from} ne ${e.name} bheja ${e.icon}` : `Aapne ${e.name} bheja ${e.icon}`,
        big: true,
      });
      void qc.invalidateQueries({ queryKey: ['me'] });
      void qc.invalidateQueries({ queryKey: ['wallet'] });
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
        push({ icon: '🎉', svgaUrl: null, title: `${m} minute poore ho gaye ✨`, big: false });
      }
    }, 1000);
    return () => clearInterval(t);
  }, [sid, qc, push]);

  const gifts = useQuery({ queryKey: ['gifts'], queryFn: () => api<{ items: Gift[] }>('/gifts'), enabled: role === 'user' && !!sid, staleTime: 60_000 });
  const session = sid ? qc.getQueryData<SessionLite>(['session', sid]) : undefined;
  const canGift = role === 'user' && !!sid && session?.status === 'ACTIVE';

  async function send(g: Gift) {
    if (!sid || sending) return;
    setSending(g.id);
    setMsg(null);
    try {
      await api(`/sessions/${sid}/gifts`, { method: 'POST', body: { giftId: g.id } });
      setSheet(false);
    } catch (e) {
      setMsg(errorMessage(e));
    } finally {
      setSending(null);
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
          style={{ position: 'absolute', right: 16, top: insets.top + 64, width: 46, height: 46, borderRadius: 23, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', elevation: 6 }}
        >
          <Ionicons name="gift" size={22} color={colors.white} />
        </Pressable>
      ) : null}

      {cur ? (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { zIndex: 50 }]}>
          {cur.svgaUrl ? <SvgaView key={cur.key} url={cur.svgaUrl} onDone={done} /> : <EmojiBurst key={cur.key} anim={cur} onDone={done} />}
          <View style={{ position: 'absolute', top: insets.top + 70, left: 0, right: 0, alignItems: 'center' }}>
            <View style={{ backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 }}>
              <Text style={{ color: colors.white }}>{cur.title}</Text>
            </View>
          </View>
        </View>
      ) : null}

      <Modal visible={sheet} transparent animationType="slide" onRequestClose={() => setSheet(false)}>
        <Pressable onPress={() => setSheet(false)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
          <Pressable onPress={() => undefined} style={{ backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: space.lg, paddingBottom: space.lg + insets.bottom, gap: space.md, maxHeight: '70%' }}>
            <Text variant="bodyStrong">Gift bhejein 🎁</Text>
            {msg ? <Text variant="small" color={colors.danger}>{msg}</Text> : null}
            <ScrollView contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
              {(gifts.data?.items ?? []).map((g) => (
                <Pressable
                  key={g.id}
                  disabled={!!sending}
                  onPress={() => send(g)}
                  style={{ width: '31%', alignItems: 'center', gap: 4, paddingVertical: space.md, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, opacity: sending && sending !== g.id ? 0.5 : 1 }}
                >
                  <Text style={{ fontSize: 34 }}>{g.icon}</Text>
                  <Text variant="small">{g.name}</Text>
                  <Text variant="caption">{sending === g.id ? 'Bhej rahe...' : rupees(g.price)}</Text>
                </Pressable>
              ))}
              {gifts.isLoading ? <Text variant="small">Load ho raha hai...</Text> : null}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
