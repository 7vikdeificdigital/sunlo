import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { onPushMessage, type PushMsg } from '@/lib/pushBus';
import { colors, font, radius, shadow, space } from '@/theme';

/** App khuli ho tab push aaye to upar ek chhota banner (4 sec). Band/background mein system khud notification dikhata hai. */
export function PushBanner() {
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  const [msg, setMsg] = useState<PushMsg | null>(null);
  const y = useRef(new Animated.Value(-160)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const hide = () => {
    clearTimeout(timer.current);
    Animated.timing(y, { toValue: -160, duration: 200, useNativeDriver: true }).start(() => setMsg(null));
  };

  useEffect(
    () =>
      onPushMessage((m) => {
        setMsg(m);
        qc.invalidateQueries({ queryKey: ['notifications'] });
        qc.invalidateQueries({ queryKey: ['me'] });
        qc.invalidateQueries({ queryKey: ['wallet'] });
        Animated.spring(y, { toValue: 0, useNativeDriver: true, bounciness: 6 }).start();
        clearTimeout(timer.current);
        timer.current = setTimeout(hide, 4000);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [qc],
  );

  useEffect(() => () => clearTimeout(timer.current), []);

  if (!msg) return null;
  return (
    <Animated.View pointerEvents="box-none" style={[s.wrap, { top: insets.top + space.sm, transform: [{ translateY: y }] }]}>
      <Pressable onPress={hide} style={s.card} accessibilityRole="alert">
        <View style={s.bar} />
        <View style={s.body}>
          <Text style={s.title} numberOfLines={1}>
            {msg.title}
          </Text>
          {msg.body ? (
            <Text style={s.text} numberOfLines={2}>
              {msg.body}
            </Text>
          ) : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  wrap: { position: 'absolute', left: space.lg, right: space.lg, zIndex: 999 },
  card: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden', ...shadow.raised },
  bar: { width: 5, backgroundColor: colors.primary },
  body: { flex: 1, paddingVertical: space.md, paddingHorizontal: space.lg, gap: 2 },
  title: { fontFamily: font.semibold, fontSize: 14, color: colors.text },
  text: { fontFamily: font.regular, fontSize: 13, color: colors.textMuted },
});
