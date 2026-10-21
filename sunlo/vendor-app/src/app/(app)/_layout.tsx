import { useQueryClient } from '@tanstack/react-query';
import { Redirect, Stack, useSegments } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { IncomingRequest } from '@/components/IncomingRequest';
import { ErrorBox, Loader, Screen } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { qk, usePending, useVendorMe } from '@/lib/queries';
import { disconnectSocket, getSocket } from '@/lib/socket';
import type { Session } from '@/lib/types';
import { colors } from '@/theme';

/** Profile ki halat ke hisaab se sahi jagah: onboarding → review → dashboard */
const GATE_FREE = ['support', 'notifications'];

export default function AppLayout() {
  const me = useVendorMe();
  const segments = useSegments() as string[];
  const qc = useQueryClient();
  const token = useAuth((s) => s.accessToken);
  const approved = me.data?.status === 'APPROVED';
  const pending = usePending(approved);
  const [incoming, setIncoming] = useState<Session | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!token) return;
    const s = getSocket();
    if (!s.connected) s.connect();
    const onIncoming = (sess: Session) => {
      setIncoming(sess);
      qc.invalidateQueries({ queryKey: qk.pending });
    };
    const onUpdate = (sess: Session) => {
      qc.setQueryData(['session', sess.id], (old: object | undefined) => (old ? { ...old, ...sess } : old));
      qc.invalidateQueries({ queryKey: qk.pending });
      if (sess.status !== 'REQUESTED') setIncoming((cur) => (cur?.id === sess.id ? null : cur));
      if (sess.status === 'COMPLETED') {
        qc.invalidateQueries({ queryKey: qk.me });
        qc.invalidateQueries({ queryKey: ['earnings'] });
        qc.invalidateQueries({ queryKey: ['vendor-sessions'] });
      }
    };
    const onNotification = () => {
      qc.invalidateQueries({ queryKey: qk.me });
      qc.invalidateQueries({ queryKey: ['notifications'] });
    };
    s.on('session:incoming', onIncoming);
    s.on('session:update', onUpdate);
    s.on('notification', onNotification);
    return () => {
      s.off('session:incoming', onIncoming);
      s.off('session:update', onUpdate);
      s.off('notification', onNotification);
    };
  }, [token, qc]);

  useEffect(() => () => disconnectSocket(), []);

  // Socket miss ho jaye to bhi (polling se) pending request dikhe
  const waiting = pending.data?.items.find((x) => x.status === 'REQUESTED' && !dismissed.has(x.id));
  const shown = incoming && !dismissed.has(incoming.id) ? incoming : waiting ?? null;
  const done = useCallback(() => {
    if (shown) setDismissed((d) => new Set(d).add(shown.id));
    setIncoming(null);
  }, [shown]);

  if (me.isLoading)
    return (
      <Screen>
        <Loader />
      </Screen>
    );
  if (me.isError || !me.data)
    return (
      <Screen>
        <ErrorBox message={errorMessage(me.error)} onRetry={() => me.refetch()} />
      </Screen>
    );

  const st = me.data.status;
  const here = segments[1] ?? '';
  const free = GATE_FREE.includes(here);
  if (!free) {
    if ((st === 'DRAFT' || st === 'REJECTED') && here !== 'onboarding') return <Redirect href="/onboarding" />;
    if (st === 'PENDING' && here !== 'pending') return <Redirect href="/pending" />;
    if (st === 'SUSPENDED' && here !== 'suspended') return <Redirect href="/suspended" />;
    if (st === 'APPROVED' && ['onboarding', 'pending', 'suspended'].includes(here)) return <Redirect href="/" />;
  }

  return (
    <>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
      {approved && shown && !here.startsWith('session') && !here.startsWith('call') ? <IncomingRequest key={shown.id} s={shown} onDone={done} /> : null}
    </>
  );
}
