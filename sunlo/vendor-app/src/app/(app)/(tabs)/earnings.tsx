import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { Button, Card, Row, Screen, Segmented, Text } from '@/components/ui';
import { formatDateTime, rupees } from '@/lib/format';
import { useEarnings, useVendorMe, useWithdrawals } from '@/lib/queries';
import type { WalletTxn } from '@/lib/types';
import { colors, font, gradient, radius, space } from '@/theme';

const TXN: Record<WalletTxn['type'], string> = {
  SESSION_EARNING: 'Session ki kamai',
  WITHDRAWAL: 'Withdrawal',
  REFUND: 'Wapas mila',
  ADJUSTMENT: 'Admin adjustment',
  RECHARGE: 'Recharge',
  RECHARGE_BONUS: 'Bonus',
  SESSION_CHARGE: 'Session',
};
const WSTATUS = { PENDING: ['Process ho raha hai', colors.busy], PAID: ['Bhej diya gaya', colors.success], REJECTED: ['Wapas hua', colors.danger] } as const;

export default function Earnings() {
  const me = useVendorMe();
  const e = useEarnings();
  const w = useWithdrawals();
  const [range, setRange] = useState<'today' | 'week' | 'month'>('week');
  const stat = e.data?.[range];
  const hasPending = w.data?.items.some((x) => x.status === 'PENDING');

  return (
    <Screen>
      <View style={{ paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.md }}>
        <Text variant="h2">Kamai</Text>
      </View>
      <ScrollView
        contentContainerStyle={{ padding: space.lg, paddingTop: 0, gap: space.lg, paddingBottom: space.xxl }}
        refreshControl={<RefreshControl refreshing={e.isRefetching} onRefresh={() => Promise.all([e.refetch(), w.refetch(), me.refetch()])} tintColor={colors.primary} />}
      >
        <LinearGradient colors={[...gradient]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: radius.xl, padding: space.xl, gap: 4 }}>
          <Text style={{ fontFamily: font.medium, fontSize: 13, color: 'rgba(255,255,255,0.9)' }}>Nikaalne layak balance</Text>
          <Text style={{ fontFamily: font.bold, fontSize: 32, color: colors.white }}>{rupees(e.data?.balance ?? 0)}</Text>
          <Text style={{ fontFamily: font.regular, fontSize: 12, color: 'rgba(255,255,255,0.85)' }}>
            Platform fee {me.data?.limits.commissionPct ?? 30}% kaat kar · kam se kam {rupees(me.data?.limits.minWithdrawalPaise ?? 50000)} nikal sakte hain
          </Text>
          <Row gap={space.sm} style={{ marginTop: space.md }}>
            <Button title={hasPending ? 'Pending hai' : 'Nikaalein'} icon="arrow-up-circle-outline" size="md" kind="secondary" disabled={hasPending} onPress={() => router.push('/withdraw')} style={{ flex: 1 }} />
            <Button title={me.data?.payout ? 'Bank / UPI' : 'Bank jodein'} icon="card-outline" size="md" kind="secondary" onPress={() => router.push('/payout')} style={{ flex: 1 }} />
          </Row>
        </LinearGradient>

        <Segmented
          value={range}
          onChange={setRange}
          options={[
            { value: 'today', label: 'Aaj' },
            { value: 'week', label: '7 din' },
            { value: 'month', label: '30 din' },
          ]}
        />
        <Row gap={space.md}>
          {[
            ['Kamai', rupees(stat?.earning ?? 0)],
            ['Minute', String(stat?.minutes ?? 0)],
            ['Sessions', String(stat?.sessions ?? 0)],
          ].map(([l, v]) => (
            <Card key={l} style={{ flex: 1, padding: space.md, gap: 2 }}>
              <Text variant="caption">{l}</Text>
              <Text style={{ fontFamily: font.semibold, fontSize: 17 }}>{v}</Text>
            </Card>
          ))}
        </Row>

        {w.data?.items.length ? (
          <>
            <Text variant="h3">Withdrawals</Text>
            {w.data.items.slice(0, 5).map((x) => (
              <Card key={x.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md }}>
                <Ionicons name="arrow-up-circle-outline" size={26} color={WSTATUS[x.status][1]} />
                <View style={{ flex: 1 }}>
                  <Text variant="bodyStrong">{rupees(x.amount)}</Text>
                  <Text variant="caption">
                    {formatDateTime(x.createdAt)}
                    {x.reference ? ` · Ref ${x.reference}` : ''}
                    {x.note ? ` · ${x.note}` : ''}
                  </Text>
                </View>
                <Text variant="label" color={WSTATUS[x.status][1]}>
                  {WSTATUS[x.status][0]}
                </Text>
              </Card>
            ))}
          </>
        ) : null}

        <Text variant="h3">Hisaab</Text>
        {(e.data?.transactions ?? []).length === 0 ? <Text variant="small">Abhi koi entry nahi.</Text> : null}
        {(e.data?.transactions ?? []).map((t) => (
          <Row key={t.id} style={{ backgroundColor: colors.surface, borderRadius: radius.md, padding: space.md }} gap={space.md}>
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong">{TXN[t.type]}</Text>
              <Text variant="caption">
                {t.note ? `${t.note} · ` : ''}
                {formatDateTime(t.createdAt)}
              </Text>
            </View>
            <Text style={{ fontFamily: font.semibold, fontSize: 14, color: t.amount > 0 ? colors.success : colors.danger }}>
              {t.amount > 0 ? '+' : '−'}
              {rupees(Math.abs(t.amount))}
            </Text>
          </Row>
        ))}
      </ScrollView>
    </Screen>
  );
}
