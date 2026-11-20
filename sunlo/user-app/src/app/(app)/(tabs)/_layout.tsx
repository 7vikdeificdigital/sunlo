import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tr, useLang } from '@/lib/i18n';
import { colors, font } from '@/theme';

type IconName = keyof typeof Ionicons.glyphMap;
const icon =
  (on: IconName, off: IconName) =>
  ({ color, focused }: { color: ColorValue; focused: boolean }) => <Ionicons name={focused ? on : off} size={23} color={color} />;

/** 6 tab: Home, Connect (random), Chat, Call, Voice, Account (History upar home ke icon se) */
export default function TabLayout() {
  const lang = useLang((st) => st.lang);
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarLabelStyle: { fontFamily: font.medium, fontSize: 11, lineHeight: lang === 'hi' ? 18 : 14 },
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, height: (lang === 'hi' ? 72 : 64) + insets.bottom, paddingTop: 6, paddingBottom: 8 + insets.bottom },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: tr('Home'), tabBarIcon: icon('home', 'home-outline') }} />
      <Tabs.Screen name="connect" options={{ title: tr('Connect'), tabBarIcon: icon('flash', 'flash-outline') }} />
      <Tabs.Screen name="chat" options={{ title: tr('Chat'), tabBarIcon: icon('chatbubbles', 'chatbubbles-outline') }} />
      <Tabs.Screen name="call" options={{ title: tr('Call'), tabBarIcon: icon('call', 'call-outline') }} />
      <Tabs.Screen name="voice" options={{ title: tr('Voice'), tabBarIcon: icon('mic', 'mic-outline') }} />
      <Tabs.Screen name="account" options={{ title: tr('Account'), tabBarIcon: icon('person-circle', 'person-circle-outline') }} />
    </Tabs>
  );
}
