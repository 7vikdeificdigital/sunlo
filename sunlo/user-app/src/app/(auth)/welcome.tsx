import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { Button, Screen, Text } from '@/components/ui';
import { colors, font, gradient, radius, shadow, space } from '@/theme';

type Slide = { icon: keyof typeof Ionicons.glyphMap; title: string; text: string; chips: { i: keyof typeof Ionicons.glyphMap; t: string }[] };

const SLIDES: Slide[] = [
  {
    icon: 'ear',
    title: 'Bondty mein swagat hai',
    text: 'Dil ki baat kehne ke liye ek surakshit jagah. Koi sunne wala mile, bina jhijhak, bina judge kiye.',
    chips: [
      { i: 'heart-outline', t: 'Dil ki baat' },
      { i: 'happy-outline', t: 'Halka mehsoos karo' },
    ],
  },
  {
    icon: 'chatbubbles',
    title: 'Chat ya call, aapki pasand',
    text: 'Verified Listeners aur Experts se chat, audio ya video call par baat karein. Payment sirf utne minute ka jitni baat ki.',
    chips: [
      { i: 'call-outline', t: 'Audio / Video' },
      { i: 'timer-outline', t: 'Per-minute payment' },
    ],
  },
  {
    icon: 'shield-checkmark',
    title: 'Private aur surakshit',
    text: 'Aapka number doosron ko nahi dikhta. Kuch galat lage to ek tap mein report karein.',
    chips: [
      { i: 'lock-closed-outline', t: '100% Private' },
      { i: 'flag-outline', t: 'Easy report' },
    ],
  },
];

export default function Welcome() {
  const { width } = useWindowDimensions();
  const [i, setI] = useState(0);
  const ref = useRef<ScrollView>(null);
  const last = i === SLIDES.length - 1;

  function onEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    setI(Math.round(e.nativeEvent.contentOffset.x / width));
  }
  function next() {
    if (last) return router.push('/terms');
    ref.current?.scrollTo({ x: (i + 1) * width, animated: true });
    setI(i + 1);
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: space.xl, height: 36 }}>
        {!last ? (
          <Pressable onPress={() => router.push('/terms')} hitSlop={10}>
            <Text style={{ fontFamily: font.medium, color: colors.textMuted }}>Skip</Text>
          </Pressable>
        ) : null}
      </View>

      <ScrollView ref={ref} horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={onEnd} style={{ flex: 1 }}>
        {SLIDES.map((s) => (
          <View key={s.title} style={{ width, paddingHorizontal: space.xl, alignItems: 'center', justifyContent: 'center', gap: space.xl }}>
            <View style={{ width: 250, height: 250, alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ position: 'absolute', width: 250, height: 250, borderRadius: 125, backgroundColor: colors.primarySoft }} />
              <View style={{ position: 'absolute', width: 190, height: 190, borderRadius: 95, backgroundColor: colors.primaryTint, opacity: 0.55 }} />
              <LinearGradient colors={[...gradient]} style={[{ width: 124, height: 124, borderRadius: 62, alignItems: 'center', justifyContent: 'center' }, shadow.raised]}>
                <Ionicons name={s.icon} size={60} color={colors.white} />
              </LinearGradient>
              <View style={[{ position: 'absolute', top: 18, right: -2, flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 7 }, shadow.card]}>
                <Ionicons name={s.chips[0]!.i} size={15} color={colors.primary} />
                <Text style={{ fontFamily: font.medium, fontSize: 12, color: colors.text }}>{s.chips[0]!.t}</Text>
              </View>
              <View style={[{ position: 'absolute', bottom: 22, left: -6, flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 7 }, shadow.card]}>
                <Ionicons name={s.chips[1]!.i} size={15} color={colors.accent} />
                <Text style={{ fontFamily: font.medium, fontSize: 12, color: colors.text }}>{s.chips[1]!.t}</Text>
              </View>
            </View>
            <View style={{ alignItems: 'center', gap: 10 }}>
              <Text style={{ fontFamily: font.bold, fontSize: 26, lineHeight: 34, color: colors.text, textAlign: 'center' }}>{s.title}</Text>
              <Text style={{ fontFamily: font.regular, fontSize: 14.5, lineHeight: 22, color: colors.textMuted, textAlign: 'center', maxWidth: 320 }}>{s.text}</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={{ paddingHorizontal: space.xl, gap: space.lg, paddingBottom: space.md }}>
        <View style={{ flexDirection: 'row', gap: 6, justifyContent: 'center' }}>
          {SLIDES.map((_, k) => (
            <View key={k} style={{ width: k === i ? 22 : 7, height: 7, borderRadius: 4, backgroundColor: k === i ? colors.primary : colors.primaryTint }} />
          ))}
        </View>
        <View style={{ backgroundColor: colors.primarySoft, borderRadius: radius.lg, padding: space.md, flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
          <Ionicons name="information-circle" size={18} color={colors.primaryDark} style={{ marginTop: 1 }} />
          <Text style={{ flex: 1, fontFamily: font.regular, fontSize: 12, lineHeight: 18, color: colors.primaryDark }}>
            Bondty sirf baat-cheet (interaction) ke liye hai. Yeh doctor, therapist, vakeel ya emergency seva nahi hai. 18+ ke liye.
          </Text>
        </View>
        <Button title={last ? 'Get Started' : 'Aage'} icon="arrow-forward" onPress={next} />
      </View>
    </Screen>
  );
}
