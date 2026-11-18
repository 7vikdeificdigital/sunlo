import { router } from 'expo-router';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView } from 'react-native';
import { ProfileForm } from '@/components/ProfileForm';
import { Header, Loader, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useVendorMe } from '@/lib/queries';
import { disconnectSocket } from '@/lib/socket';
import { colors, space } from '@/theme';

export default function EditProfile() {
  const me = useVendorMe();
  const { signOut } = useAuth();

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

  return (
    <Screen edges={['top', 'bottom']}>
      <Header title="Profile edit" />
      {!me.data ? (
        <Loader />
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
          <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg }} keyboardShouldPersistTaps="handled">
            <ProfileForm me={me.data} mode="edit" onSaved={() => router.back()} />
            <Pressable onPress={askDelete} accessibilityRole="button" style={{ paddingVertical: space.lg, alignItems: 'center' }}>
              <Text variant="small" color={colors.textMuted}>
                Account delete karein
              </Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </Screen>
  );
}
