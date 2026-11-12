import { useQueryClient } from '@tanstack/react-query';
import { GiftLayer } from '@/components/GiftLayer';
import { PushBanner } from '@/components/PushBanner';
import { Redirect, Stack, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { Loader, Screen } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { registerPush } from '@/lib/push';
import { emitPushMessage } from '@/lib/pushBus';
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
    // Balance khatam hone se 1 minute pehle chetavani (CCPA: achanak call na kate)
    const onLow = (p: { sessionId: string; secondsLeft: number }) =>
      emitPushMessage({ title: 'Balance khatam hone wala hai', body: `Lagbhag ${Math.max(1, Math.round(p.secondsLeft / 60))} minute bacha hai. Baat jaari rakhni ho to abhi recharge karein.` });
    s.on('session:update', onUpdate);
    s.on('session:low_balance', onLow);
    return () => {
      s.off('session:update', onUpdate);
      s.off('session:low_balance', onLow);
    };
  }, [token, qc]);

  useEffect(() => () => disconnectSocket(), []);

  // Push notification (FCM): login ke baad token server ko
  const signedIn = !!token;
  useEffect(() => {
    if (!signedIn) return;
    let off: (() => void) | undefined;
    let gone = false;
    void registerPush().then((f) => (gone ? f() : (off = f)));
    return () => {
      gone = true;
      off?.();
    };
  }, [signedIn]);

  if (me.isLoading) {
    return (
      <Screen>
        <Loader />
      </Screen>
    );
  }
  const onOnboarding = segments.includes('onboarding' as never);
  const onConsent = segments.includes('consent' as never) || segments.includes('legal' as never);
  if (me.data && !me.data.user.profileComplete && !onOnboarding) return <Redirect href="/onboarding" />;
  // Naya privacy notice / janm-tithi baaki (DPDP): ek baar sahmati screen
  if (me.data && me.data.user.profileComplete && (me.data.needsConsent || me.data.needsDob) && !onConsent && !onOnboarding) return <Redirect href="/consent" />;

  return (
    <>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
      <GiftLayer role="user" />
      <PushBanner />
    </>
  );
}
