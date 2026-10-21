import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { Avatar } from '@/components/Avatar';
import { CallView } from '@/components/CallView';
import { Button, Card, ErrorBox, Header, Loader, Row, Screen, Text } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { durationText, mmss, rupees } from '@/lib/format';
import { useElapsed, useLiveSession, useRemaining } from '@/lib/useLiveSession';
import { callGradient, colors, font, space } from '@/theme';

export default function VendorCall() {
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
        <ErrorBox message={errorMessage(q.error)} />
      </Screen>
    );
  if (!active)
    return (
      <Screen>
        <Header title="Call" />
        <Card style={{ margin: space.lg, gap: space.sm }}>
          <Text variant="h3">{s.status === 'COMPLETED' ? 'Call poori hui' : 'Call chal nahi rahi'}</Text>
          {s.status === 'COMPLETED' ? (
            <>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text variant="small">Samay</Text>
                <Text variant="bodyStrong">{durationText(s.billedSeconds)}</Text>
              </Row>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text variant="small">User se charge</Text>
                <Text variant="bodyStrong">{rupees(s.chargedAmount)}</Text>
              </Row>
            </>
          ) : null}
          <Button title="Dashboard par wapas" kind="ghost" size="md" onPress={() => router.replace('/')} />
        </Card>
      </Screen>
    );

  return (
    <LinearGradient colors={[...callGradient]} style={{ flex: 1 }}>
      <Screen edges={['top', 'bottom']} style={{ backgroundColor: 'transparent' }}>
        <View style={{ alignItems: 'center', paddingTop: space.xxl, gap: space.sm }}>
          <Avatar name={s.user?.name ?? 'User'} size={110} />
          <Text style={{ fontFamily: font.semibold, fontSize: 22, color: colors.white, marginTop: space.md }}>{s.user?.name ?? 'User'}</Text>
          {s.intake?.topic ? <Text style={{ fontFamily: font.medium, fontSize: 13, color: 'rgba(255,255,255,0.75)' }}>Topic: {s.intake.topic}</Text> : null}
          <Text style={{ fontFamily: font.medium, fontSize: 15, color: 'rgba(255,255,255,0.85)' }}>{mmss(elapsed)}</Text>
          {remaining !== null ? <Text style={{ fontFamily: font.regular, fontSize: 12.5, color: 'rgba(255,255,255,0.6)' }}>User ke balance se bacha samay: {mmss(remaining)}</Text> : null}
        </View>
        <CallView sessionId={s.id} video={s.type === 'VIDEO'} onEnd={() => void api(`/sessions/${s.id}/end`, { method: 'POST' }).catch(() => undefined)} />
      </Screen>
    </LinearGradient>
  );
}
