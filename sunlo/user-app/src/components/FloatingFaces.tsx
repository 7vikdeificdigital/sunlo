import { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import { Avatar } from './Avatar';

// anchor (0..1 of box), avatar size, naam (sirf rang/initial ke liye), drift range, speed
const FACES = [
  { x: 0.08, y: 0.18, s: 38, n: 'Aarav', d: 12, t: 2600 },
  { x: 0.80, y: 0.10, s: 44, n: 'Meera', d: 14, t: 3100 },
  { x: 0.92, y: 0.52, s: 34, n: 'Kabir', d: 10, t: 2300 },
  { x: 0.70, y: 0.86, s: 42, n: 'Sana', d: 13, t: 2900 },
  { x: 0.20, y: 0.82, s: 36, n: 'Rohan', d: 11, t: 3400 },
  { x: 0.00, y: 0.50, s: 32, n: 'Isha', d: 9, t: 2000 },
  { x: 0.46, y: 0.00, s: 30, n: 'Dev', d: 8, t: 2700 },
  { x: 0.50, y: 0.97, s: 30, n: 'Tara', d: 8, t: 3200 },
];

function Face({ f, w, h }: { f: (typeof FACES)[number]; w: number; h: number }) {
  const a = useRef(new Animated.Value(0)).current;
  const b = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const mk = (v: Animated.Value, ms: number) => Animated.loop(Animated.sequence([Animated.timing(v, { toValue: 1, duration: ms, easing: Easing.inOut(Easing.sin), useNativeDriver: true }), Animated.timing(v, { toValue: 0, duration: ms, easing: Easing.inOut(Easing.sin), useNativeDriver: true })]));
    const l1 = mk(a, f.t), l2 = mk(b, f.t * 1.35);
    l1.start(); l2.start();
    return () => { l1.stop(); l2.stop(); };
  }, [a, b, f.t]);
  return (
    <Animated.View
      style={{
        position: 'absolute', left: f.x * (w - f.s), top: f.y * (h - f.s),
        opacity: a.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }),
        transform: [
          { translateX: a.interpolate({ inputRange: [0, 1], outputRange: [-f.d, f.d] }) },
          { translateY: b.interpolate({ inputRange: [0, 1], outputRange: [f.d, -f.d] }) },
          { scale: b.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.08] }) },
        ],
      }}
    >
      <Avatar name={f.n} size={f.s} ring />
    </Animated.View>
  );
}

/** Logo ke aas-paas hamesha tairte hue chehre ("log aa rahe hain" wala feel) */
export function FloatingFaces({ width, height }: { width: number; height: number }) {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', width, height }}>
      {FACES.map((f) => <Face key={f.n} f={f} w={width} h={height} />)}
    </View>
  );
}
