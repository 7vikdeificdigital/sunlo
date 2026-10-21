import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ReportSheet } from '@/components/ReportSheet';
import { vendorStatus } from '@/components/VendorCard';
import { Avatar } from '@/components/Avatar';
import { StartSessionSheet } from '@/components/StartSessionSheet';
import { Button, Card, ErrorBox, Header, Loader, Row, Screen, Text } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { compact, formatDate, perMin } from '@/lib/format';
import { useVendor, useVendorReviews } from '@/lib/queries';
import type { SessionType } from '@/lib/types';
import { colors, font, radius, space } from '@/theme';

function confirm(title: string, msg: string, onOk: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${msg}`)) onOk();
    return;
  }
  Alert.alert(title, msg, [
    { text: 'Nahi', style: 'cancel' },
    { text: 'Haan', style: 'destructive', onPress: onOk },
  ]);
}

export default function VendorProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const q = useVendor(id);
  const reviews = useVendorReviews(id);
  const [reporting, setReporting] = useState(false);
  const [start, setStart] = useState<SessionType | null>(null);
  const [followBusy, setFollowBusy] = useState(false);

  if (q.isLoading)
    return (
      <Screen>
        <Header title="Profile" />
        <Loader />
      </Screen>
    );
  if (q.isError || !q.data)
    return (
      <Screen>
        <Header title="Profile" />
        <ErrorBox message={errorMessage(q.error)} onRetry={() => q.refetch()} />
      </Screen>
    );

  const a = q.data;
  const status = vendorStatus(a);

  async function toggleFavorite() {
    setFollowBusy(true);
    try {
      await api(`/vendors/${a.id}/favorite`, { method: a.isFavorite ? 'DELETE' : 'POST' });
      qc.invalidateQueries({ queryKey: ['favorites'] });
      await q.refetch();
    } finally {
      setFollowBusy(false);
    }
  }

  function block() {
    confirm('Block karein?', `${a.displayName} aapko list mein nahi dikhenge aur aap unse session nahi kar payenge.`, async () => {
      await api(`/vendors/${a.id}/block`, { method: 'POST', body: {} });
      qc.invalidateQueries({ queryKey: ['vendors'] });
      router.back();
    });
  }

  return (
    <Screen edges={['top']}>
      <Header
        title={a.displayName}
        right={
          <Row gap={2}>
            <Pressable onPress={toggleFavorite} hitSlop={8} accessibilityLabel={a.isFavorite ? 'Favorite se hatayein' : 'Favorite karein'} style={{ padding: 6 }} disabled={followBusy}>
              <Ionicons name={a.isFavorite ? 'heart' : 'heart-outline'} size={22} color={a.isFavorite ? colors.danger : colors.textMuted} />
            </Pressable>
            <Pressable onPress={() => setReporting(true)} hitSlop={8} accessibilityLabel="Report karein" style={{ padding: 6 }}>
              <Ionicons name="flag-outline" size={20} color={colors.textMuted} />
            </Pressable>
            <Pressable onPress={block} hitSlop={8} accessibilityLabel="Block karein" style={{ padding: 6 }}>
              <Ionicons name="ban-outline" size={20} color={colors.textMuted} />
            </Pressable>
          </Row>
        }
      />
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: 120 }}>
        <Card style={{ alignItems: 'center', gap: space.sm }}>
          <Avatar name={a.displayName} uri={a.avatarUrl} size={96} status={status} ring={a.isOnline} />
          <Row gap={4}>
            <Text variant="h2">{a.displayName}</Text>
            <Ionicons name="checkmark-circle" size={18} color={colors.info} />
          </Row>
          <Text variant="body" color={colors.textMuted} style={{ textAlign: 'center' }}>
            {a.headline}
          </Text>
          <Row gap={6} style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
            {a.categories.map((c) => (
              <View key={c.id} style={{ backgroundColor: c.kind === 'LISTENER' ? colors.primarySoft : '#E6F0FF', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 }}>
                <Text variant="label" color={c.kind === 'LISTENER' ? colors.primaryDark : colors.info}>
                  {c.name}
                </Text>
              </View>
            ))}
          </Row>
          <Text variant="small">
            {a.languages.join(', ')} · {a.experienceYears} saal anubhav
          </Text>
          <Row style={{ marginTop: space.md, alignSelf: 'stretch', justifyContent: 'space-around' }}>
            {[
              [a.ratingCount ? a.ratingAvg.toFixed(1) : 'Naya', `${compact(a.ratingCount)} reviews`, 'star'],
              [compact(a.totalSessions), 'sessions', 'people'],
              [compact(a.totalMinutes), 'minutes', 'chatbubble-ellipses'],
            ].map(([v, l, i]) => (
              <View key={l} style={{ alignItems: 'center', gap: 2 }}>
                <Row gap={4}>
                  <Ionicons name={i as 'star'} size={14} color={colors.primary} />
                  <Text style={{ fontFamily: font.semibold, fontSize: 16 }}>{v}</Text>
                </Row>
                <Text variant="caption">{l}</Text>
              </View>
            ))}
          </Row>
        </Card>

        <Card style={{ gap: space.sm }}>
          <Text variant="h3">Parichay</Text>
          <Text variant="body" color={colors.textMuted}>
            {a.bio || 'Jaankari jald aayegi.'}
          </Text>
          {a.tags.length ? (
            <Row gap={6} style={{ flexWrap: 'wrap', marginTop: 4 }}>
              {a.tags.map((t) => (
                <View key={t} style={{ backgroundColor: colors.surfaceAlt, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 4 }}>
                  <Text variant="label" color={colors.text}>
                    #{t}
                  </Text>
                </View>
              ))}
            </Row>
          ) : null}
        </Card>

        <Card style={{ gap: space.md }}>
          <Text variant="h3">Ratings & Reviews</Text>
          {reviews.data?.items.length ? (
            reviews.data.items.map((r) => (
              <View key={r.id} style={{ gap: 4, paddingBottom: space.md, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Text variant="bodyStrong">{r.userName}</Text>
                  <Text variant="caption">{formatDate(r.createdAt)}</Text>
                </Row>
                <Row gap={2}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Ionicons key={i} name={i < r.rating ? 'star' : 'star-outline'} size={13} color={colors.primary} />
                  ))}
                </Row>
                {r.comment ? <Text variant="body">{r.comment}</Text> : null}
                {r.reply ? (
                  <View style={{ backgroundColor: colors.surfaceAlt, padding: space.sm, borderRadius: radius.sm, marginTop: 4 }}>
                    <Text variant="caption">{a.displayName.split(' ')[0]} ka jawab</Text>
                    <Text variant="small" color={colors.text}>
                      {r.reply}
                    </Text>
                  </View>
                ) : null}
              </View>
            ))
          ) : (
            <Text variant="small">Abhi tak koi review nahi.</Text>
          )}
        </Card>
      </ScrollView>

      {/* Neeche chipke Chat/Call/Video button */}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: space.sm, padding: space.lg, paddingBottom: space.lg + insets.bottom, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border }}>
        {a.chatEnabled ? (
          <Button
            title={`Chat · ${perMin(a.chatRatePerMin)}`}
            kind={status === 'online' ? 'primary' : 'ghost'}
            disabled={status !== 'online'}
            style={{ flex: 1 }}
            onPress={() => setStart('CHAT')}
          />
        ) : null}
        {a.callEnabled ? (
          <Button
            title={`Call · ${perMin(a.callRatePerMin)}`}
            kind={status === 'online' ? 'success' : 'ghost'}
            disabled={status !== 'online'}
            style={{ flex: 1 }}
            onPress={() => setStart('AUDIO')}
          />
        ) : null}
        {a.videoEnabled ? (
          <Button
            title={`Video · ${perMin(a.videoRatePerMin)}`}
            kind={status === 'online' ? 'secondary' : 'ghost'}
            disabled={status !== 'online'}
            style={{ flex: 1 }}
            onPress={() => setStart('VIDEO')}
          />
        ) : null}
      </View>
      {status !== 'online' ? (
        <View style={{ position: 'absolute', bottom: 86 + insets.bottom, alignSelf: 'center', backgroundColor: colors.text, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 6 }}>
          <Text style={{ fontFamily: font.medium, fontSize: 12, color: colors.white }}>{status === 'busy' ? 'Abhi doosre session mein hain' : 'Abhi offline hain'}</Text>
        </View>
      ) : null}

      {start ? <StartSessionSheet vendor={a} initialType={start} onClose={() => setStart(null)} /> : null}
      {reporting ? <ReportSheet vendorId={a.id} onClose={() => setReporting(false)} /> : null}
    </Screen>
  );
}
