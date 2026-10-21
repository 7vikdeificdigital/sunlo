import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { Avatar } from '@/components/Avatar';
import { Empty, Loader, Row, Screen, Segmented, Text } from '@/components/ui';
import { WalletChip } from '@/components/WalletChip';
import { durationText, formatDateTime, rupees } from '@/lib/format';
import { useSessions, useWalletTxns } from '@/lib/queries';
import type { Session, WalletTxn } from '@/lib/types';
import { colors, font, radius, shadow, space } from '@/theme';

type Tab = 'wallet' | 'chat' | 'call';

const TXN_LABEL: Record<WalletTxn['type'], string> = {
  RECHARGE: 'Wallet recharge',
  RECHARGE_BONUS: 'Recharge bonus',
  SESSION_CHARGE: 'Consultation',
  SESSION_EARNING: 'Earning',
  REFUND: 'Refund',
  WITHDRAWAL: 'Withdrawal',
  ADJUSTMENT: 'Adjustment',
};

const STATUS: Record<Session['status'], { label: string; color: string }> = {
  REQUESTED: { label: 'Pending', color: colors.busy },
  ACTIVE: { label: 'Chal raha hai', color: colors.success },
  COMPLETED: { label: 'Poora hua', color: colors.success },
  REJECTED: { label: 'Reject hua', color: colors.danger },
  CANCELLED: { label: 'Cancel', color: colors.textMuted },
  MISSED: { label: 'Jawab nahi mila', color: colors.textMuted },
};

export default function HistoryTab() {
  const [tab, setTab] = useState<Tab>('wallet');
  return (
    <Screen>
      <Row style={{ paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.md }} gap={space.md}>
        <Text variant="h2" style={{ flex: 1 }}>
          History
        </Text>
        <WalletChip />
      </Row>
      <View style={{ paddingHorizontal: space.lg, marginBottom: space.md }}>
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'wallet', label: 'Wallet' },
            { value: 'chat', label: 'Chat' },
            { value: 'call', label: 'Call' },
          ]}
        />
      </View>
      {tab === 'wallet' ? <WalletList /> : <SessionList kind={tab} />}
    </Screen>
  );
}

function WalletList() {
  const q = useWalletTxns();
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];
  if (q.isLoading) return <Loader />;
  return (
    <FlatList
      data={items}
      keyExtractor={(t) => t.id}
      refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={colors.primary} />}
      onEndReached={() => q.hasNextPage && q.fetchNextPage()}
      ListEmptyComponent={<Empty icon="wallet-outline" title="Abhi koi transaction nahi" action="Recharge karein" onAction={() => router.push('/wallet')} />}
      contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: space.xl, gap: space.sm }}
      renderItem={({ item }) => {
        const credit = item.amount > 0;
        return (
          <View style={{ backgroundColor: colors.surface, borderRadius: radius.md, padding: space.md, flexDirection: 'row', alignItems: 'center', gap: space.md, ...shadow.card }}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: credit ? colors.successSoft : colors.dangerSoft, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={credit ? 'arrow-down' : 'arrow-up'} size={18} color={credit ? colors.success : colors.danger} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong">{TXN_LABEL[item.type]}</Text>
              <Text variant="caption">
                {item.note ? `${item.note} · ` : ''}
                {formatDateTime(item.createdAt)}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ fontFamily: font.semibold, fontSize: 14, color: credit ? colors.success : colors.danger }}>
                {credit ? '+' : '−'}
                {rupees(Math.abs(item.amount))}
              </Text>
              <Text variant="caption">Bal {rupees(item.balanceAfter)}</Text>
            </View>
          </View>
        );
      }}
    />
  );
}

function SessionList({ kind }: { kind: 'chat' | 'call' }) {
  const q = useSessions(kind === 'chat' ? 'CHAT' : undefined);
  const items = (q.data?.items ?? []).filter((s) => (kind === 'chat' ? s.type === 'CHAT' : s.type !== 'CHAT'));
  if (q.isLoading) return <Loader />;
  return (
    <FlatList
      data={items}
      keyExtractor={(s) => s.id}
      refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={colors.primary} />}
      ListEmptyComponent={
        <Empty
          icon={kind === 'chat' ? 'chatbubbles-outline' : 'call-outline'}
          title={kind === 'chat' ? 'Abhi tak koi chat nahi' : 'Abhi tak koi call nahi'}
          action="Kisi se baat karein"
          onAction={() => router.push(kind === 'chat' ? '/chat' : '/call')}
        />
      }
      contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: space.xl, gap: space.sm }}
      renderItem={({ item }) => {
        const st = STATUS[item.status];
        return (
          <Pressable
            onPress={() => router.push(item.type === 'CHAT' ? `/session/${item.id}` : `/call/${item.id}`)}
            style={{ backgroundColor: colors.surface, borderRadius: radius.md, padding: space.md, flexDirection: 'row', gap: space.md, alignItems: 'center', ...shadow.card }}
          >
            <Avatar name={item.vendor?.displayName ?? 'A'} uri={item.vendor?.avatarUrl} size={46} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="bodyStrong" numberOfLines={1}>
                {item.vendor?.displayName}
              </Text>
              <Text variant="caption">
                {item.type === 'CHAT' ? 'Chat' : item.type === 'AUDIO' ? 'Voice call' : 'Video call'} · {formatDateTime(item.requestedAt)}
              </Text>
              <Row gap={6}>
                <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: st.color }} />
                <Text variant="caption" color={st.color}>
                  {st.label}
                  {item.status === 'COMPLETED' ? ` · ${durationText(item.billedSeconds)}` : ''}
                </Text>
              </Row>
            </View>
            {item.chargedAmount > 0 ? <Text style={{ fontFamily: font.semibold, fontSize: 14 }}>{rupees(item.chargedAmount)}</Text> : null}
            <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
          </Pressable>
        );
      }}
    />
  );
}
