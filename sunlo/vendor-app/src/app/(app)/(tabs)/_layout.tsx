import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';
import { tr, useLang } from '@/lib/i18n';
import { colors, font } from '@/theme';

type IconName = keyof typeof Ionicons.glyphMap;
const icon =
  (on: IconName, off: IconName) =>
  ({ color, focused }: { color: ColorValue; focused: boolean }) => <Ionicons name={focused ? on : off} size={23} color={color} />;

export default function TabLayout() {
  useLang((st) => st.lang);
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarLabelStyle: { fontFamily: font.medium, fontSize: 11, lineHeight: 14 },
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, height: 64, paddingTop: 6, paddingBottom: 8 },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: tr('Home'), tabBarIcon: icon('home', 'home-outline') }} />
      <Tabs.Screen name="sessions" options={{ title: tr('Sessions'), tabBarIcon: icon('chatbubbles', 'chatbubbles-outline') }} />
      <Tabs.Screen name="earnings" options={{ title: tr('Kamai'), tabBarIcon: icon('wallet', 'wallet-outline') }} />
      <Tabs.Screen name="reviews" options={{ title: tr('Reviews'), tabBarIcon: icon('star', 'star-outline') }} />
      <Tabs.Screen name="account" options={{ title: tr('Account'), tabBarIcon: icon('person-circle', 'person-circle-outline') }} />
    </Tabs>
  );
}
