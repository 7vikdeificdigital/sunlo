import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { BackHandler, Platform, Pressable, ScrollView, View } from 'react-native';
import { Button, Header, Screen, Text } from '@/components/ui';
import { COMPANY, CONSENTS, LAST_UPDATED, TERMS_INTRO, TERMS_SECTIONS } from '@/lib/legalText';
import { useTerms } from '@/lib/terms';
import { colors, font, radius, shadow, space } from '@/theme';

function Check({ on, text, onPress }: { on: boolean; text: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="checkbox" accessibilityState={{ checked: on }} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
      <View style={{ width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: on ? colors.primary : colors.textFaint, backgroundColor: on ? colors.primary : colors.surface, alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
        {on ? <Ionicons name="checkmark" size={16} color={colors.white} /> : null}
      </View>
      <Text style={{ flex: 1, fontFamily: font.regular, fontSize: 13, lineHeight: 19, color: colors.text }}>{text}</Text>
    </Pressable>
  );
}

export default function Terms() {
  const accept = useTerms((s) => s.accept);
  const already = useTerms((s) => s.accepted);
  const [ticks, setTicks] = useState<boolean[]>(CONSENTS.map(() => false));
  const [busy, setBusy] = useState(false);
  const all = ticks.every(Boolean);

  async function agree() {
    if (!all || busy) return;
    setBusy(true);
    await accept();
    router.replace('/login');
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <Header title="Partner Terms" subtitle={`Aakhri update: ${LAST_UPDATED}`} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: space.xl, gap: space.lg, paddingBottom: space.xl }}>
        <View style={{ backgroundColor: colors.primarySoft, borderRadius: radius.lg, padding: space.lg }}>
          <Text style={{ fontFamily: font.medium, fontSize: 13, lineHeight: 20, color: colors.primaryDark }}>{TERMS_INTRO}</Text>
        </View>

        {TERMS_SECTIONS.map((sec, n) => (
          <View key={sec.title} style={[{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.lg, gap: 8 }, shadow.card]}>
            <Text style={{ fontFamily: font.semibold, fontSize: 15, color: colors.text }}>
              {n + 1}. {sec.title}
            </Text>
            {sec.points.map((p, k) => (
              <View key={k} style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: colors.primary, marginTop: 8 }} />
                <Text style={{ flex: 1, fontFamily: font.regular, fontSize: 13, lineHeight: 20, color: colors.textMuted }}>{p}</Text>
              </View>
            ))}
          </View>
        ))}

        {COMPANY.legalName || COMPANY.address ? (
          <Text variant="caption" style={{ textAlign: 'center' }}>
            {[COMPANY.legalName, COMPANY.address].filter(Boolean).join(', ')}
          </Text>
        ) : null}
      </ScrollView>

      {already ? (
        <View style={{ padding: space.xl }}>
          <Button title="Wapas jayein" kind="secondary" onPress={() => router.back()} />
        </View>
      ) : (
      <View style={[{ backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: space.xl, gap: space.md }, shadow.raised]}>
        {CONSENTS.map((c, k) => (
          <Check key={k} on={ticks[k]!} text={c} onPress={() => setTicks((t) => t.map((v, j) => (j === k ? !v : v)))} />
        ))}
        <Button title="Sahmat hoon, aage badhein" icon="checkmark-circle" onPress={agree} disabled={!all} loading={busy} />
        {Platform.OS === 'android' ? (
          <Pressable onPress={() => BackHandler.exitApp()} style={{ alignItems: 'center', paddingVertical: 4 }}>
            <Text style={{ fontFamily: font.medium, fontSize: 13, color: colors.textMuted }}>Sahmat nahi, app band karein</Text>
          </Pressable>
        ) : null}
      </View>
      )}
    </Screen>
  );
}
