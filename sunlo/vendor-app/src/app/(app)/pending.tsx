import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { RefreshControl, ScrollView, View } from 'react-native';
import { Avatar } from '@/components/Avatar';
import { Button, Card, Row, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useVendorMe } from '@/lib/queries';
import { disconnectSocket } from '@/lib/socket';
import { colors, radius, space } from '@/theme';

export default function Pending() {
  const me = useVendorMe();
  const { refreshToken, signOut } = useAuth();
  const v = me.data;
  return (
    <Screen edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={{ padding: space.xl, gap: space.lg, flexGrow: 1, justifyContent: 'center' }} refreshControl={<RefreshControl refreshing={me.isRefetching} onRefresh={() => me.refetch()} tintColor={colors.primary} />}>
        <View style={{ alignItems: 'center', gap: space.md }}>
          <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="hourglass-outline" size={40} color={colors.primaryDark} />
          </View>
          <Text variant="h2" style={{ textAlign: 'center' }}>
            Profile review mein hai
          </Text>
          <Text variant="body" color={colors.textMuted} style={{ textAlign: 'center' }}>
            Hamari team aapki jaankari aur ID jaanch rahi hai. Approve hote hi notification aayega, phir aap online hokar kamaana shuru kar sakte hain.
          </Text>
        </View>
        {v ? (
          <Card style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
            <Avatar name={v.displayName} uri={v.avatarUrl} size={54} />
            <View style={{ flex: 1 }}>
              <Text variant="title">{v.displayName}</Text>
              <Text variant="small" numberOfLines={1}>
                {v.headline}
              </Text>
              <Text variant="caption">{v.categories.map((c) => c.name).join(' · ')}</Text>
            </View>
          </Card>
        ) : null}
        <Row gap={10} style={{ backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: space.md }}>
          <Ionicons name="information-circle-outline" size={18} color={colors.textMuted} />
          <Text variant="small" style={{ flex: 1 }}>
            Neeche kheench kar (pull) status taaza karein.
          </Text>
        </Row>
        <Button title="Support se baat karein" kind="ghost" onPress={() => router.push('/support')} />
        <Button
          title="Logout"
          kind="ghost"
          onPress={async () => {
            await api('/auth/logout', { method: 'POST', body: { refreshToken } }).catch(() => undefined);
            disconnectSocket();
            await signOut();
          }}
        />
      </ScrollView>
    </Screen>
  );
}
