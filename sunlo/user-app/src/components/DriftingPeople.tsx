import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, LayoutChangeEvent, Pressable, View } from 'react-native';
import { Avatar } from '@/components/Avatar';
import { Text } from '@/components/ui';
import type { RandomPerson } from '@/lib/randomConnect';
import { colors, font } from '@/theme';

const SIZE = 64;
const CELL_W = 92;
const CELL_H = 118;

// stable pseudo-random (id se) taaki har refresh par chehre jump na karein
const hash = (s: string) => { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };

function Bubble({ p, left, top, rangeX, rangeY }: { p: RandomPerson; left: number; top: number; rangeX: number; rangeY: number }) {
  const h = hash(p.id);
  const x = useRef(new Animated.Value(0)).current;
  const y = useRef(new Animated.Value(0)).current;
  const o = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const dur = (m: number) => 5200 + (h % 4000) * m;
    const loop = (v: Animated.Value, a: number, b: number, ms: number) =>
      Animated.loop(Animated.sequence([Animated.timing(v, { toValue: a, duration: ms, easing: Easing.inOut(Easing.sin), useNativeDriver: true }), Animated.timing(v, { toValue: b, duration: ms * 1.2, easing: Easing.inOut(Easing.sin), useNativeDriver: true })]));
    const dx = (h % 2 ? 1 : -1) * rangeX, dy = ((h >> 3) % 2 ? 1 : -1) * rangeY;
    const lx = loop(x, dx, -dx, dur(1)), ly = loop(y, -dy, dy, dur(1.3));
    x.setValue(-dx * 0.5); y.setValue(dy * 0.5);
    lx.start(); ly.start();
    Animated.timing(o, { toValue: 1, duration: 700, delay: (h % 6) * 120, useNativeDriver: true }).start();
    return () => { lx.stop(); ly.stop(); };
  }, [h, x, y, o, rangeX, rangeY]);

  const video = p.types.includes('VIDEO');
  return (
    <Animated.View style={{ position: 'absolute', left, top, width: CELL_W, alignItems: 'center', opacity: o, transform: [{ translateX: x }, { translateY: y }] }}>
      <Pressable onPress={() => router.push(`/vendor/${p.id}`)} accessibilityRole="button" accessibilityLabel={p.name} style={{ alignItems: 'center' }}>
        <View style={{ width: SIZE + 8, height: SIZE + 8, borderRadius: (SIZE + 8) / 2, padding: 3, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' }}>
          <Avatar name={p.name} uri={p.avatarUrl} size={SIZE} ring />
          <View style={{ position: 'absolute', left: -2, top: 0, width: 24, height: 24, borderRadius: 12, backgroundColor: colors.online, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' }}>
            <Ionicons name={video ? 'videocam' : p.types.includes('AUDIO') ? 'call' : 'chatbubble'} size={12} color="#fff" />
          </View>
          {p.language ? (
            <View style={{ position: 'absolute', bottom: -8, backgroundColor: '#fff', borderRadius: 9, paddingHorizontal: 8, paddingVertical: 1.5 }}>
              <Text style={{ fontFamily: font.semibold, fontSize: 10.5, color: colors.primaryDark }}>{p.language}</Text>
            </View>
          ) : null}
        </View>
        <Text numberOfLines={1} style={{ fontFamily: font.medium, fontSize: 12, color: '#fff', marginTop: 12 }}>{p.name}</Text>
      </Pressable>
    </Animated.View>
  );
}

/** "FRND Connect Rooms" jaisa: online listeners ke chehre poori screen par dheere-dheere tairte hain. Chehre par tap = unki profile. */
export function DriftingPeople({ people }: { people: RandomPerson[] }) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const onLayout = (e: LayoutChangeEvent) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });

  const placed = useMemo(() => {
    if (!box.w || !box.h) return [];
    const cols = Math.max(2, Math.floor(box.w / CELL_W));
    const rows = Math.max(2, Math.floor(box.h / CELL_H));
    const cells = Array.from({ length: cols * rows }, (_, i) => i);
    // cells ko id-hash se fixed (par mixed) order mein baanto
    const order = [...cells].sort((a, b) => hash(`${a}x`) - hash(`${b}x`));
    const gapX = (box.w - cols * CELL_W) / cols, gapY = (box.h - rows * CELL_H) / rows;
    return people.slice(0, cells.length).map((p, i) => {
      const c = order[i]!;
      const col = c % cols, row = Math.floor(c / cols);
      return { p, left: col * (CELL_W + gapX) + gapX / 2, top: row * (CELL_H + gapY) + gapY / 2, rangeX: Math.min(26, (CELL_W + gapX) / 2.6), rangeY: Math.min(24, (CELL_H + gapY) / 3) };
    });
  }, [people, box]);

  return (
    <View style={{ flex: 1 }} onLayout={onLayout}>
      {placed.map((b) => <Bubble key={b.p.id} {...b} />)}
    </View>
  );
}
