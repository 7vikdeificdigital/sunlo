import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { FlatList, View } from 'react-native';
import { Empty, Header, Loader, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { useNotifications } from '@/lib/queries';
import { colors, radius, shadow, space } from '@/theme';

export default function Notifications() {
  const q = useNotifications();
  const qc = useQueryClient();
  useEffect(() => {
    if (q.data?.unread) {
      api('/notifications/read', { method: 'POST', body: {} })
        .then(() => qc.invalidateQueries({ queryKey: ['notifications'] }))
        .catch(() => undefined);
    }
  }, [q.data?.unread, qc]);
  return (
    <Screen edges={['top']}>
      <Header title="Notifications" />
      {q.isLoading ? (
        <Loader />
      ) : (
        <FlatList
          data={q.data?.items ?? []}
          keyExtractor={(n) => n.id}
          contentContainerStyle={{ padding: space.lg, gap: space.sm }}
          ListEmptyComponent={<Empty icon="notifications-outline" title="Koi notification nahi" />}
          renderItem={({ item }) => (
            <View style={{ backgroundColor: colors.surface, borderRadius: radius.md, padding: space.md, flexDirection: 'row', gap: space.md, ...shadow.card }}>
              <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="notifications" size={18} color={colors.primaryDark} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="bodyStrong">{item.title}</Text>
                <Text variant="small">{item.body}</Text>
                <Text variant="caption">{formatDateTime(item.createdAt)}</Text>
              </View>
              {!item.readAt ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginTop: 6 }} /> : null}
            </View>
          )}
        />
      )}
    </Screen>
  );
}
