import { Redirect, Stack, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { useTerms } from '@/lib/terms';
import { colors } from '@/theme';

export default function AuthLayout() {
  const { ready, accepted, hydrate } = useTerms();
  const segments = useSegments();
  const last = segments[segments.length - 1] as string | undefined;

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  if (!ready) return null;
  // Pehli baar: Get Started, phir Terms. Sahmati ke bina login nahi khulega.
  if (!accepted && last !== 'welcome' && last !== 'terms') return <Redirect href="/welcome" />;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="welcome" />
      <Stack.Screen name="terms" />
      <Stack.Screen name="login" />
      <Stack.Screen name="otp" />
    </Stack>
  );
}
