import { Ionicons } from '@expo/vector-icons';
import { KeyboardAvoidingView, ScrollView, View } from 'react-native';
import { ProfileForm } from '@/components/ProfileForm';
import { Loader, Row, Screen, Text } from '@/components/ui';
import { useVendorMe } from '@/lib/queries';
import { colors, radius, space } from '@/theme';

/** Naya vendor: profile bharkar approval ke liye bhejna. Reject hua ho to wajah upar dikhti hai. */
export default function Onboarding() {
  const me = useVendorMe();
  if (!me.data) return <Loader />;
  const rejected = me.data.status === 'REJECTED';
  return (
    <Screen edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView contentContainerStyle={{ padding: space.xl, gap: space.lg }} keyboardShouldPersistTaps="handled">
          <View style={{ gap: 4, marginTop: space.sm }}>
            <Text variant="h1">{rejected ? 'Profile mein badlav' : 'Partner banein'}</Text>
            <Text variant="body" color={colors.textMuted}>
              Apni profile bharein. Hamari team 24-48 ghante mein jaanch karke approve karegi.
            </Text>
          </View>
          {rejected && me.data.rejectionReason ? (
            <Row gap={10} align="flex-start" style={{ backgroundColor: colors.dangerSoft, borderRadius: radius.md, padding: space.md }}>
              <Ionicons name="alert-circle" size={20} color={colors.danger} />
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong" color={colors.danger}>
                  Admin ka sandesh
                </Text>
                <Text variant="small" color={colors.text}>
                  {me.data.rejectionReason}
                </Text>
              </View>
            </Row>
          ) : null}
          <ProfileForm me={me.data} mode="onboarding" onSaved={() => me.refetch()} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
