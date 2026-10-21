import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { Alert, Platform, Pressable, ScrollView, Share, View } from 'react-native';
import { Avatar } from '@/components/Avatar';
import { Card, Row, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { rupees } from '@/lib/format';
import { useMe } from '@/lib/queries';
import { disconnectSocket } from '@/lib/socket';
import { colors, radius, space } from '@/theme';

type IconName = keyof typeof Ionicons.glyphMap;

function ask(title: string, msg: string, ok: string, fn: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${msg}`)) fn();
    return;
  }
  Alert.alert(title, msg, [
    { text: 'Nahi', style: 'cancel' },
    { text: ok, style: 'destructive', onPress: fn },
  ]);
}

/** Account tab: profile, wallet, favorites, support, logout */
export default function Account() {
  const me = useMe();
  const { refreshToken, signOut } = useAuth();
  const u = me.data?.user;

  async function logout() {
    await api('/auth/logout', { method: 'POST', body: { refreshToken } }).catch(() => undefined);
    disconnectSocket();
    await signOut();
  }

  const items: { icon: IconName; label: string; href?: Href; onPress?: () => void }[] = [
    { icon: 'wallet-outline', label: 'Wallet aur recharge', href: '/wallet' },
    { icon: 'time-outline', label: 'Order history', href: '/history' },
    { icon: 'heart-outline', label: 'Favorites', href: '/favorites' },
    { icon: 'medkit-outline', label: 'Mushkil waqt mein madad', href: '/help' },
    { icon: 'notifications-outline', label: 'Notifications', href: '/notifications' },
    { icon: 'help-buoy-outline', label: 'Help aur Support', href: '/support' },
    {
      icon: 'gift-outline',
      label: 'Refer karein',
      onPress: () => Share.share({ message: `Sunlo app par trained listeners aur experts se private baat karein. Mera referral code: ${u?.referralCode}` }).catch(() => undefined),
    },
  ];

  return (
    <Screen edges={['top']}>
      <View style={{ paddingHorizontal: space.lg, paddingTop: space.sm }}>
        <Text variant="h2">Account</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: space.xxl }}>
        <Card onPress={() => router.push('/profile')}>
          <Row gap={space.md}>
            <Avatar name={u?.name ?? 'U'} size={58} />
            <View style={{ flex: 1 }}>
              <Text variant="h3">{u?.name}</Text>
              <Text variant="small">{u?.phone}</Text>
              <Text variant="label" color={colors.primaryDark}>
                Profile edit karein
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text variant="caption">Wallet</Text>
              <Text variant="title">{rupees(me.data?.walletBalance ?? 0)}</Text>
            </View>
          </Row>
        </Card>

        <Card style={{ padding: 0 }}>
          {items.map((it, i) => (
            <Pressable
              key={it.label}
              onPress={it.onPress ?? (() => it.href && router.push(it.href))}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: 15, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border, backgroundColor: pressed ? colors.surfaceAlt : 'transparent' })}
            >
              <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={it.icon} size={18} color={colors.primaryDark} />
              </View>
              <Text variant="bodyStrong" style={{ flex: 1 }}>
                {it.label}
              </Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
            </Pressable>
          ))}
        </Card>

        {u?.referralCode ? (
          <View style={{ backgroundColor: colors.primarySoft, borderRadius: radius.md, padding: space.md, flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text variant="small" color={colors.primaryDark}>
              Aapka referral code
            </Text>
            <Text variant="title" color={colors.primaryDark}>
              {u.referralCode}
            </Text>
          </View>
        ) : null}

        <Card style={{ padding: 0 }}>
          <Pressable onPress={() => ask('Logout karein?', 'Aap is device se logout ho jayenge.', 'Logout', logout)} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg }}>
            <Ionicons name="log-out-outline" size={20} color={colors.danger} />
            <Text variant="bodyStrong" color={colors.danger}>
              Logout
            </Text>
          </Pressable>
          <Pressable
            onPress={() =>
              ask('Account delete karein?', 'Aapki personal jaankari hata di jayegi. Wallet ka bacha balance wapas nahi milega. Yeh wapas nahi ho sakta.', 'Delete', async () => {
                await api('/me', { method: 'DELETE' });
                disconnectSocket();
                await signOut();
              })
            }
            style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderTopWidth: 1, borderTopColor: colors.border }}
          >
            <Ionicons name="trash-outline" size={20} color={colors.textMuted} />
            <Text variant="body" color={colors.textMuted}>
              Account delete karein
            </Text>
          </Pressable>
        </Card>
        <Text variant="caption" style={{ textAlign: 'center' }}>
          Sunlo v1.0.0
        </Text>
      </ScrollView>
    </Screen>
  );
}
