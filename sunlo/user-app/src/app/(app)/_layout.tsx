import { useQueryClient } from '@tanstack/react-query';
import { GiftLayer } from '@/components/GiftLayer';
import { Redirect, Stack, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { Loader, Screen } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { qk, useMe } from '@/lib/queries';
import { disconnectSocket, getSocket } from '@/lib/socket';
import type { Session } from '@/lib/types';
import { colors } from '@/theme';

export default function AppLayout() {
  const me = useMe();
  const segments = useSegments();
  const qc = useQueryClient();
  const token = useAuth((s) => s.accessToken);

  // Real-time: session ki har badli halat par wallet/history taaza
  useEffect(() => {
    if (!token) return;
    const s = getSocket();
    if (!s.connected) s.connect();
    const onUpdate = (sess: Session) => {
      qc.setQueryData(['session', sess.id], (old: object | undefined) => (old ? { ...old, ...sess } : old));
      if (['COMPLETED', 'REJECTED', 'MISSED', 'CANCELLED'].includes(sess.status)) {
        qc.invalidateQueries({ queryKey: qk.me });
        qc.invalidateQueries({ queryKey: qk.wallet });
        qc.invalidateQueries({ queryKey: ['sessions'] });
      }
    };
    s.on('session:update', onUpdate);
    return () => {
      s.off('session:update', onUpdate);
    };
  }, [token, qc]);

  useEffect(() => () => disconnectSocket(), []);

  if (me.isLoading) {
    return (
      <Screen>
        <Loader />
      </Screen>
    );
  }
  const onOnboarding = segments.includes('onboarding' as never);
  if (me.data && !me.data.user.profileComplete && !onOnboarding) return <Redirect href="/onboarding" />;

  return (
    <>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
      <GiftLayer role="user" />
    </>
  );
}
