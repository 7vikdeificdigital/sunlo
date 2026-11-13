import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Logo } from '@/components/Logo';
import { Text } from '@/components/ui';
import { useLang, type Lang } from '@/lib/i18n';
import { colors, font, radius, shadow, space } from '@/theme';

const OPTIONS: { lang: Lang; title: string; sub: string }[] = [
  { lang: 'hi', title: 'हिंदी', sub: 'पूरा ऐप हिंदी में' },
  { lang: 'en', title: 'English', sub: 'The whole app in English' },
  { lang: 'hinglish', title: 'Hinglish', sub: 'Hindi + English mix, jaise hum bolte hain' },
];

/** Pehli baar app kholne par: bhasha chuno. Baad mein Account mein badal sakte hain. */
export function LanguageChooser() {
  const setLang = useLang((s) => s.setLang);
  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: space.xl, gap: space.lg }}>
        <View style={{ alignItems: 'center', marginBottom: space.md }}>
          <Logo size={60} />
        </View>
        <View style={{ alignItems: 'center', gap: 4, marginBottom: space.sm }}>
          <Text raw style={{ fontFamily: font.bold, fontSize: 22, lineHeight: 36, color: colors.text, textAlign: 'center' }}>
            अपनी भाषा चुनें
          </Text>
          <Text raw style={{ fontFamily: font.medium, fontSize: 16, lineHeight: 24, color: colors.textMuted, textAlign: 'center' }}>
            Choose your language
          </Text>
        </View>
        {OPTIONS.map((o) => (
          <Pressable
            key={o.lang}
            onPress={() => setLang(o.lang)}
            accessibilityRole="button"
            accessibilityLabel={o.title}
            style={({ pressed }) => [
              {
                flexDirection: 'row',
                alignItems: 'center',
                gap: space.md,
                backgroundColor: colors.surface,
                borderRadius: radius.lg,
                borderWidth: 1.5,
                borderColor: pressed ? colors.primary : colors.border,
                paddingVertical: 16,
                paddingHorizontal: space.lg,
              },
              shadow.card,
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text raw style={{ fontFamily: font.semibold, fontSize: 18, lineHeight: 30, color: colors.text }}>
                {o.title}
              </Text>
              <Text raw style={{ fontFamily: font.regular, fontSize: 13, lineHeight: 21, color: colors.textMuted }}>
                {o.sub}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color={colors.primary} />
          </Pressable>
        ))}
        <Text raw style={{ fontFamily: font.regular, fontSize: 12, lineHeight: 20, color: colors.textFaint, textAlign: 'center', marginTop: space.md }}>
          आप इसे बाद में अकाउंट में बदल सकते हैं · You can change this later in Account
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
