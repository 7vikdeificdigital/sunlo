import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, View } from 'react-native';
import { api, errorMessage } from '@/lib/api';
import { durationText, rupees } from '@/lib/format';
import { useElapsed, type SessionDetail } from '@/lib/useLiveSession';
import { colors, radius, space } from '@/theme';
import { Avatar } from './Avatar';
import { Button, Card, Input, Row, Text } from './ui';

/** Vendor ke accept karne ka intezaar */
export function WaitingView({ s }: { s: SessionDetail }) {
  const pulse = useRef(new Animated.Value(0)).current;
  const waited = useElapsed(s.requestedAt, true);
  const [cancelling, setCancelling] = useState(false);
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 1600, easing: Easing.out(Easing.ease), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  const left = Math.max(0, 60 - waited);
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xxl, gap: space.lg }}>
      <View style={{ alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View
          style={{
            position: 'absolute',
            width: 150,
            height: 150,
            borderRadius: 75,
            backgroundColor: colors.primaryTint,
            opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] }),
            transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.4] }) }],
          }}
        />
        <Avatar name={s.vendor.displayName} uri={s.vendor.avatarUrl} size={110} ring />
      </View>
      <Text variant="h2" style={{ textAlign: 'center' }}>
        {s.vendor.displayName}
      </Text>
      <Text variant="body" color={colors.textMuted} style={{ textAlign: 'center' }}>
        Request bhej di gayi hai. {s.vendor.displayName.split(' ')[0]} ke accept karte hi {s.type === 'CHAT' ? 'chat' : 'call'} shuru ho jayegi.
      </Text>
      <Text variant="small">{left > 0 ? `Lagbhag ${left} second` : 'Thoda aur intezaar...'}</Text>
      <Text variant="caption" style={{ textAlign: 'center' }}>
        Jab tak baat shuru nahi hoti, koi paisa nahi katega.
      </Text>
      <Button
        title="Request cancel karein"
        kind="ghost"
        loading={cancelling}
        onPress={async () => {
          setCancelling(true);
          await api(`/sessions/${s.id}/cancel`, { method: 'POST' }).catch(() => undefined);
          setCancelling(false);
        }}
      />
    </View>
  );
}

const ENDED_TEXT: Record<string, string> = {
  REJECTED: 'Abhi request accept nahi ho payi.',
  MISSED: 'Samay par jawab nahi mila.',
  CANCELLED: 'Request cancel ho gayi.',
};

/** Session shuru hi nahi hua */
export function NotStartedView({ s }: { s: SessionDetail }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xxl, gap: space.md }}>
      <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="time-outline" size={34} color={colors.textMuted} />
      </View>
      <Text variant="h3" style={{ textAlign: 'center' }}>
        {ENDED_TEXT[s.status] ?? 'Session khatam'}
      </Text>
      <Text variant="small" style={{ textAlign: 'center' }}>
        {s.endReason === 'INSUFFICIENT_BALANCE' ? 'Wallet mein balance kam tha. Recharge karke dobara koshish karein.' : 'Aapke wallet se koi paisa nahi kata.'}
      </Text>
      <Button title="Doosre profiles dekhein" onPress={() => router.replace(s.type === 'CHAT' ? '/chat' : '/call')} style={{ marginTop: space.md }} />
    </View>
  );
}

/** Session poora hone ke baad: hisaab + review */
export function SummaryCard({ s }: { s: SessionDetail }) {
  const qc = useQueryClient();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [state, setState] = useState<'idle' | 'saving' | 'done'>('idle');
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setState('saving');
    setErr(null);
    try {
      await api(`/sessions/${s.id}/review`, { method: 'POST', body: { rating, comment: comment.trim() || undefined } });
      setState('done');
      qc.invalidateQueries({ queryKey: ['vendor', s.vendorId] });
    } catch (e) {
      setErr(errorMessage(e));
      setState(errorMessage(e).includes('pehle de chuke') ? 'done' : 'idle');
    }
  }

  return (
    <Card style={{ margin: space.lg, gap: space.md }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text variant="h3">Session poora hua</Text>
        <Ionicons name="checkmark-circle" size={22} color={colors.success} />
      </Row>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text variant="small">Samay</Text>
        <Text variant="bodyStrong">{durationText(s.billedSeconds)}</Text>
      </Row>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text variant="small">Rate</Text>
        <Text variant="bodyStrong">{rupees(s.ratePerMin)}/min</Text>
      </Row>
      <Row style={{ justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: space.sm }}>
        <Text variant="bodyStrong">Kul katauti</Text>
        <Text variant="h3">{rupees(s.chargedAmount)}</Text>
      </Row>
      {s.billedSeconds > 0 ? (
        state === 'done' ? (
          <Text variant="small" color={colors.success}>
            Review ke liye dhanyavaad!
          </Text>
        ) : (
          <View style={{ gap: space.sm, backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: space.md }}>
            <Text variant="bodyStrong">Aapka anubhav kaisa raha?</Text>
            <Row gap={6}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Pressable key={n} onPress={() => setRating(n)} hitSlop={6} accessibilityLabel={`${n} star`}>
                  <Ionicons name={n <= rating ? 'star' : 'star-outline'} size={30} color={colors.primary} />
                </Pressable>
              ))}
            </Row>
            {rating ? <Input value={comment} onChangeText={setComment} placeholder="Kuch likhna chahein (optional)" maxLength={1000} multiline /> : null}
            {err ? (
              <Text variant="small" color={colors.danger}>
                {err}
              </Text>
            ) : null}
            {rating ? <Button title="Review bhejein" size="md" loading={state === 'saving'} onPress={submit} /> : null}
          </View>
        )
      ) : null}
    </Card>
  );
}
