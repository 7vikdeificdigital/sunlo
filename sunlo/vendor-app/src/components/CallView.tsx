import { Ionicons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';
import { colors, font } from '@/theme';
import { Text } from './ui';

/** Web preview: audio/video call sirf Android/iOS app mein chalti hai */
export function CallView({ onEnd }: { sessionId: string; video: boolean; onEnd: () => void }) {
  return (
    <View style={{ flex: 1, justifyContent: 'flex-end', paddingBottom: 30, gap: 24 }}>
      <Text style={{ color: colors.white, textAlign: 'center', fontFamily: font.medium, paddingHorizontal: 30 }}>
        Call ki awaaz/video sirf mobile app mein chalti hai. Yeh web preview hai.
      </Text>
      <Pressable onPress={onEnd} accessibilityLabel="End" style={{ alignSelf: 'center', alignItems: 'center', gap: 6 }}>
        <View style={{ width: 62, height: 62, borderRadius: 31, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.danger }}>
          <Ionicons name="call" size={26} color={colors.white} />
        </View>
        <Text style={{ fontFamily: font.medium, fontSize: 11.5, color: colors.white }}>End</Text>
      </Pressable>
    </View>
  );
}
