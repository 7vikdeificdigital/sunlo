import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '@/components/Avatar';
import { CallView } from '@/components/CallView';
import { NotStartedView, SummaryCard, WaitingView } from '@/components/SessionStates';
import { ErrorBox, Header, Loader, Screen, Text } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { mmss } from '@/lib/format';
import { useElapsed, useLiveSession, useRemaining } from '@/lib/useLiveSession';
import { callGradient, colors, font, space } from '@/theme';

export default function CallScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useLiveSession(id);
  const s = q.data;
  const active = s?.status === 'ACTIVE';
  const remaining = useRemaining(s?.endsAt, active);
  const elapsed = useElapsed(s?.acceptedAt, active);

  if (q.isLoading)
    return (
      <Screen>
        <Header title="Call" />
        <Loader />
      </Screen>
    );
  if (!s)
    return (
      <Screen>
        <Header title="Call" />
        <ErrorBox message={errorMessage(q.error)} onRetry={() => q.refetch()} />
      </Screen>
    );

  if (s.status === 'REQUESTED')
    return (
      <Screen>
        <Header title="Call connect ho rahi hai" />
        <WaitingView s={s} />
      </Screen>
    );
  if (s.status === 'COMPLETED')
    return (
      <Screen>
        <Header title={s.vendor.displayName} />
        <ScrollView>
          <SummaryCard s={s} />
        </ScrollView>
      </Screen>
    );
  if (s.status !== 'ACTIVE')
    return (
      <Screen>
        <Header title={s.vendor.displayName} />
        <NotStartedView s={s} />
      </Screen>
    );

  const low = remaining !== null && remaining <= 120;
  return (
    <LinearGradient colors={[...callGradient]} style={{ flex: 1 }}>
      <Screen edges={['top', 'bottom']} style={{ backgroundColor: 'transparent' }}>
        <View style={{ alignItems: 'center', paddingTop: space.xxl, gap: space.sm }}>
          <Avatar name={s.vendor.displayName} uri={s.vendor.avatarUrl} size={110} ring />
          <Text style={{ fontFamily: font.semibold, fontSize: 22, color: colors.white, marginTop: space.md }}>{s.vendor.displayName}</Text>
          <Text style={{ fontFamily: font.medium, fontSize: 15, color: 'rgba(255,255,255,0.8)' }}>{mmss(elapsed)}</Text>
          {remaining !== null ? (
            <Text style={{ fontFamily: font.regular, fontSize: 12.5, color: low ? '#FF8A8A' : 'rgba(255,255,255,0.6)' }}>Balance se bacha samay: {mmss(remaining)}</Text>
          ) : null}
          {low ? (
            <Pressable onPress={() => router.push('/wallet')} style={{ flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, marginTop: 6 }}>
              <Ionicons name="wallet-outline" size={15} color={colors.white} />
              <Text style={{ color: colors.white, fontFamily: font.medium, fontSize: 12.5 }}>Recharge karke samay badhayein</Text>
            </Pressable>
          ) : null}
        </View>
        <CallView
          sessionId={s.id}
          video={s.type === 'VIDEO'}
          onEnd={async () => {
            await api(`/sessions/${s.id}/end`, { method: 'POST' }).catch(() => undefined);
          }}
        />
      </Screen>
    </LinearGradient>
  );
}
