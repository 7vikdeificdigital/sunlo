import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { Avatar } from '@/components/Avatar';
import { Empty, Loader, Row, Screen, Text } from '@/components/ui';
import { durationText, formatDateTime, rupees } from '@/lib/format';
import { useVendorSessions } from '@/lib/queries';
import type { Session } from '@/lib/types';
import { colors, font, radius, shadow, space } from '@/theme';

const STATUS: Record<Session['status'], { label: string; color: string }> = {
  REQUESTED: { label: 'Pending', color: colors.busy },
  ACTIVE: { label: 'Chal raha hai', color: colors.success },
  COMPLETED: { label: 'Poora hua', color: colors.success },
  REJECTED: { label: 'Aapne reject kiya', color: colors.textMuted },
  CANCELLED: { label: 'User ne cancel kiya', color: colors.textMuted },
  MISSED: { label: 'Miss hua', color: colors.danger },
};

export default function Sessions() {
  const q = useVendorSessions();
  return (
    <Screen>
      <View style={{ paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.md }}>
        <Text variant="h2">Sessions</Text>
      </View>
      {q.isLoading ? (
        <Loader />
      ) : (
        <FlatList
          data={q.data?.items ?? []}
          keyExtractor={(s) => s.id}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={colors.primary} />}
          contentContainerStyle={{ paddingHorizontal: space.lg, gap: space.sm, paddingBottom: space.xl }}
          ListEmptyComponent={<Empty icon="chatbubbles-outline" title="Abhi tak koi session nahi" text="Online rahein, requests jald aayengi" />}
          renderItem={({ item }) => {
            const st = STATUS[item.status];
            return (
              <Pressable
                onPress={() => (item.type === 'CHAT' ? router.push(`/session/${item.id}`) : item.status === 'ACTIVE' ? router.push(`/call/${item.id}`) : undefined)}
                style={{ backgroundColor: colors.surface, borderRadius: radius.md, padding: space.md, flexDirection: 'row', gap: space.md, alignItems: 'center', ...shadow.card }}
              >
                <Avatar name={item.userName ?? 'U'} size={44} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="bodyStrong">{item.userName}</Text>
                  <Text variant="caption">
                    {item.type === 'CHAT' ? 'Chat' : item.type === 'AUDIO' ? 'Voice call' : 'Video call'}
                    {item.intake?.topic ? ` · ${item.intake.topic}` : ''} · {formatDateTime(item.requestedAt)}
                  </Text>
                  <Row gap={6}>
                    <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: st.color }} />
                    <Text variant="caption" color={st.color}>
                      {st.label}
                      {item.status === 'COMPLETED' ? ` · ${durationText(item.billedSeconds)}` : ''}
                    </Text>
                  </Row>
                </View>
                {item.vendorEarning ? <Text style={{ fontFamily: font.semibold, fontSize: 14, color: colors.success }}>+{rupees(item.vendorEarning)}</Text> : null}
                {item.type === 'CHAT' ? <Ionicons name="chevron-forward" size={18} color={colors.textFaint} /> : null}
              </Pressable>
            );
          }}
        />
      )}
    </Screen>
  );
}
