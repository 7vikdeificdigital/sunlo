import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { Alert, Platform, Pressable, ScrollView, View } from 'react-native';
import { Avatar } from '@/components/Avatar';
import { LanguagePicker } from '@/components/LanguagePicker';
import { Card, Row, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useVendorMe } from '@/lib/queries';
import { disconnectSocket } from '@/lib/socket';
import { colors, space } from '@/theme';

type IconName = keyof typeof Ionicons.glyphMap;

export default function Account() {
  const me = useVendorMe();
  const { refreshToken, signOut } = useAuth();
  const v = me.data;

  async function logout() {
    await api('/vendor/status', { method: 'PATCH', body: { isOnline: false } }).catch(() => undefined);
    await api('/auth/logout', { method: 'POST', body: { refreshToken } }).catch(() => undefined);
    disconnectSocket();
    await signOut();
  }
  function askLogout() {
    if (Platform.OS === 'web') {
      if (window.confirm('Logout karein? Aap offline ho jayenge.')) void logout();
      return;
    }
    Alert.alert('Logout karein?', 'Aap offline ho jayenge.', [
      { text: 'Nahi', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: () => void logout() },
    ]);
  }

  async function deleteAccount() {
    try {
      await api('/me', { method: 'DELETE' });
    } catch (e) {
      const msg = (e as { message?: string })?.message ?? 'Account delete nahi ho paya. Support se sampark karein.';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Delete nahi hua', msg);
      return;
    }
    disconnectSocket();
    await signOut();
  }
  function askDelete() {
    const title = 'Account delete karein?';
    const msg = 'Aapki profile turant band ho jayegi aur personal jaankari hata di jayegi. Pehle apni kamai withdraw kar lein: bacha balance wapas nahi milega. Yeh wapas nahi ho sakta.';
    if (Platform.OS === 'web') {
      if (window.confirm(`${title}\n\n${msg}`)) void deleteAccount();
      return;
    }
    Alert.alert(title, msg, [
      { text: 'Nahi', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void deleteAccount() },
    ]);
  }

  const items: { icon: IconName; label: string; sub?: string; href: Href }[] = [
    { icon: 'person-outline', label: 'Profile edit karein', sub: 'Naam, parichay, topics, photo', href: '/edit-profile' },
    { icon: 'pricetags-outline', label: 'Rate aur services', sub: 'Chat / call / video ka rate', href: '/rates' },
    { icon: 'card-outline', label: 'Bank / UPI details', sub: v?.payout ? (v.payout.method === 'UPI' ? v.payout.upiId : `A/c ••••${v.payout.accountLast4}`) : 'Abhi nahi joda', href: '/payout' },
    { icon: 'document-text-outline', label: 'PAN (TDS)', sub: v?.pan ? `XXXXXX${v.pan.last4} · TDS ${v.tds?.pctWithPan ?? 0.1}%` : `Abhi nahi joda · TDS ${v?.tds?.pctWithoutPan ?? 5}% katega`, href: '/pan' },
    { icon: 'receipt-outline', label: 'Mahine ka statement', sub: 'Gross, platform fee, TDS, net', href: '/statement' },
    { icon: 'calendar-outline', label: 'Booked calls', sub: 'Users ki booking confirm karein', href: '/bookings' },
    { icon: 'notifications-outline', label: 'Notifications', href: '/notifications' },
    { icon: 'help-buoy-outline', label: 'Help aur Support', href: '/support' },
  ];

  return (
    <Screen>
      <View style={{ paddingHorizontal: space.lg, paddingTop: space.sm }}>
        <Text variant="h2">Account</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: space.xxl }}>
        {v ? (
          <Card style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
            <Avatar name={v.displayName} uri={v.avatarUrl} size={58} />
            <View style={{ flex: 1 }}>
              <Text variant="h3">{v.displayName}</Text>
              <Text variant="small">{v.phone}</Text>
              <Row gap={4}>
                <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                <Text variant="caption" color={colors.success}>
                  Verified partner
                </Text>
              </Row>
            </View>
          </Card>
        ) : null}
        <Card style={{ padding: 0 }}>
          {items.map((it, i) => (
            <Pressable
              key={it.label}
              onPress={() => router.push(it.href)}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: 14, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border, backgroundColor: pressed ? colors.surfaceAlt : 'transparent' })}
            >
              <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={it.icon} size={18} color={colors.primaryDark} />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong">{it.label}</Text>
                {it.sub ? <Text variant="caption">{it.sub}</Text> : null}
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
            </Pressable>
          ))}
        </Card>
        <Card>
          <LanguagePicker />
        </Card>

        <Card style={{ padding: 0 }}>
          <Pressable onPress={askLogout} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg }}>
            <Ionicons name="log-out-outline" size={20} color={colors.danger} />
            <Text variant="bodyStrong" color={colors.danger}>
              Logout
            </Text>
          </Pressable>
          <Pressable
            onPress={askDelete}
            accessibilityRole="button"
            style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderTopWidth: 1, borderTopColor: colors.border }}
          >
            <Ionicons name="trash-outline" size={20} color={colors.textMuted} />
            <Text variant="body" color={colors.textMuted}>
              Account delete karein
            </Text>
          </Pressable>
        </Card>
        <Text variant="caption" style={{ textAlign: 'center' }}>
          Bondty Partner v1.0.0
        </Text>
      </ScrollView>
    </Screen>
  );
}
