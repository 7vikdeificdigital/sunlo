import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Card, ErrorBox, Header, Loader, Row, Screen, Text } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { rupees } from '@/lib/format';
import { useStatement } from '@/lib/queries';
import { colors, space } from '@/theme';

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

function Line({ l, v, strong, minus, color }: { l: string; v: number; strong?: boolean; minus?: boolean; color?: string }) {
  return (
    <Row style={{ justifyContent: 'space-between' }}>
      <Text variant={strong ? 'bodyStrong' : 'small'} color={color}>
        {l}
      </Text>
      <Text variant={strong ? 'h3' : 'bodyStrong'} color={color}>
        {minus ? '− ' : ''}
        {rupees(v)}
      </Text>
    </Row>
  );
}

/** Mahine ka kamai statement: gross -> platform fee -> TDS -> net */
export default function StatementScreen() {
  const [offset, setOffset] = useState(0);
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - offset);
  const month = monthKey(d);
  const q = useStatement(month);
  const s = q.data;
  return (
    <Screen edges={['top']}>
      <Header title="Mahine ka statement" />
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: space.xxl }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Pressable onPress={() => setOffset((o) => o + 1)} hitSlop={10} accessibilityLabel="Pichhla mahina">
            <Ionicons name="chevron-back" size={22} color={colors.primaryDark} />
          </Pressable>
          <Text variant="h3">{d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</Text>
          <Pressable onPress={() => setOffset((o) => Math.max(0, o - 1))} hitSlop={10} disabled={offset === 0} accessibilityLabel="Agla mahina">
            <Ionicons name="chevron-forward" size={22} color={offset === 0 ? colors.textFaint : colors.primaryDark} />
          </Pressable>
        </Row>
        {q.isLoading ? (
          <Loader />
        ) : q.error || !s ? (
          <ErrorBox message={errorMessage(q.error)} onRetry={() => q.refetch()} />
        ) : (
          <>
            <Card style={{ gap: space.sm }}>
              <Text variant="small">
                {s.sessions} session · {s.minutes} minute
              </Text>
              <Line l="Sessions (users ne diya + free trial)" v={s.sessionGross} />
              <Line l="Gifts" v={s.giftGross} />
              <Line l="Kul gross" v={s.gross} strong />
              <Line l="Platform fee" v={s.commission} minus />
              <Line l="Aapki kamai" v={s.earning} />
              <Line l={`TDS ${s.pan ? `(PAN ${s.pan})` : '(PAN nahi: 5%)'}`} v={s.tds} minus color={s.pan ? undefined : colors.danger} />
              <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: space.sm }}>
                <Line l="Net (aapko milega)" v={s.net} strong color={colors.success} />
              </View>
            </Card>
            <Card style={{ gap: space.sm }}>
              {s.freeTrialPaidByPlatform ? <Line l="Free trial ke minute (Bondty ne diye)" v={s.freeTrialPaidByPlatform} /> : null}
              {s.adjustments ? <Line l="Admin adjustment" v={s.adjustments} /> : null}
              <Line l="Is mahine nikala" v={s.withdrawn} />
            </Card>
            <Text variant="caption">{s.note}</Text>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
