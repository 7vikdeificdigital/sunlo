import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { View } from 'react-native';
import { Button, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { rupees } from '@/lib/format';
import { useVendorMe } from '@/lib/queries';
import { disconnectSocket } from '@/lib/socket';
import { colors, radius, space } from '@/theme';

export default function Suspended() {
  const me = useVendorMe();
  const { refreshToken, signOut } = useAuth();
  return (
    <Screen edges={['top', 'bottom']}>
      <View style={{ flex: 1, padding: space.xl, gap: space.lg, justifyContent: 'center' }}>
        <View style={{ alignItems: 'center', gap: space.md }}>
          <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: colors.dangerSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="pause-circle-outline" size={44} color={colors.danger} />
          </View>
          <Text variant="h2">Profile suspend hai</Text>
          {me.data?.rejectionReason ? (
            <View style={{ backgroundColor: colors.surface, borderRadius: radius.md, padding: space.md, alignSelf: 'stretch' }}>
              <Text variant="small" color={colors.text}>
                {me.data.rejectionReason}
              </Text>
            </View>
          ) : null}
          <Text variant="small" style={{ textAlign: 'center' }}>
            Wallet balance: {rupees(me.data?.walletBalance ?? 0)}. Sawaal ho to support se baat karein.
          </Text>
        </View>
        <Button title="Support se baat karein" onPress={() => router.push('/support')} />
        <Button
          title="Logout"
          kind="ghost"
          onPress={async () => {
            await api('/auth/logout', { method: 'POST', body: { refreshToken } }).catch(() => undefined);
            disconnectSocket();
            await signOut();
          }}
        />
      </View>
    </Screen>
  );
}
