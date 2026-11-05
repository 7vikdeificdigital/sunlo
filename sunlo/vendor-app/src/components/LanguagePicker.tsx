import { Pressable, View } from 'react-native';
import { Text } from '@/components/ui';
import { LANG_LABEL, useLang, type Lang } from '@/lib/i18n';
import { colors, font, radius, space } from '@/theme';

/** Bhasha chunne ka toggle: Hinglish / English / हिंदी */
export function LanguagePicker() {
  const { lang, setLang } = useLang();
  return (
    <View style={{ gap: space.sm }}>
      <Text variant="label">Language</Text>
      <View style={{ flexDirection: 'row', backgroundColor: colors.surfaceAlt, borderRadius: radius.pill, padding: 3 }}>
        {(['en', 'hi', 'hinglish'] as Lang[]).map((l) => {
          const on = lang === l;
          return (
            <Pressable
              key={l}
              onPress={() => setLang(l)}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              style={{ flex: 1, paddingVertical: 9, borderRadius: radius.pill, alignItems: 'center', backgroundColor: on ? colors.surface : 'transparent' }}
            >
              <Text raw style={{ fontFamily: on ? font.semibold : font.medium, fontSize: 13, color: on ? colors.primaryDark : colors.textMuted }}>
                {LANG_LABEL[l]}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
