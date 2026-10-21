import { router } from 'expo-router';
import { KeyboardAvoidingView, ScrollView } from 'react-native';
import { ProfileForm } from '@/components/ProfileForm';
import { Header, Loader, Screen } from '@/components/ui';
import { useVendorMe } from '@/lib/queries';
import { space } from '@/theme';

export default function EditProfile() {
  const me = useVendorMe();
  return (
    <Screen edges={['top', 'bottom']}>
      <Header title="Profile edit" />
      {!me.data ? (
        <Loader />
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
          <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg }} keyboardShouldPersistTaps="handled">
            <ProfileForm me={me.data} mode="edit" onSaved={() => router.back()} />
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </Screen>
  );
}
