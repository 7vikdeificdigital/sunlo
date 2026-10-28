import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Modal, Pressable, View } from 'react-native';
import { Button, Empty, Header, Loader, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { useNotifications } from '@/lib/queries';
import { colors, radius, shadow, space } from '@/theme';

type Item = { id: string; title: string; body: string; readAt: string | null; createdAt: string; data?: { type?: string; ticketId?: string } | null };

export default function Notifications() {
  const q = useNotifications();
  const qc = useQueryClient();
  const [open, setOpen] = useState<Item | null>(null);
  useEffect(() => {
    if (q.data?.unread) {
      api('/notifications/read', { method: 'POST', body: {} })
        .then(() => qc.invalidateQueries({ queryKey: ['notifications'] }))
        .catch(() => undefined);
    }
  }, [q.data?.unread, qc]);

  const isWarn = (n: Item) => n.data?.type === 'warning';

  function onOpen(n: Item) {
    if (n.data?.type === 'ticket' && n.data.ticketId) {
      router.push(`/support/${n.data.ticketId}` as never);
      return;
    }
    setOpen(n);
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <Header title="Notifications" />
      {q.isLoading ? (
        <Loader />
      ) : (
        <FlatList
          data={(q.data?.items ?? []) as Item[]}
          keyExtractor={(n) => n.id}
          contentContainerStyle={{ padding: space.lg, gap: space.sm }}
          ListEmptyComponent={<Empty icon="notifications-outline" title="Koi notification nahi" />}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => onOpen(item)}
              style={{ backgroundColor: colors.surface, borderRadius: radius.md, padding: space.md, flexDirection: 'row', gap: space.md, ...shadow.card }}
            >
              <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: isWarn(item) ? '#F8D0CC' : colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={isWarn(item) ? 'warning' : 'notifications'} size={18} color={isWarn(item) ? colors.danger : colors.primaryDark} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="bodyStrong">{item.title}</Text>
                <Text variant="small" numberOfLines={2}>
                  {item.body}
                </Text>
                <Text variant="caption">{formatDateTime(item.createdAt)} · Dabakar poori dekhein</Text>
              </View>
              {!item.readAt ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginTop: 6 }} /> : null}
            </Pressable>
          )}
        />
      )}
      <Modal visible={!!open} transparent animationType="fade" onRequestClose={() => setOpen(null)}>
        <Pressable onPress={() => setOpen(null)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: space.lg }}>
          <Pressable onPress={() => undefined} style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.lg, gap: space.md }}>
            <Text variant="bodyStrong">{open?.title}</Text>
            <Text variant="body">{open?.body}</Text>
            <Text variant="caption">{open ? formatDateTime(open.createdAt) : ''}</Text>
            <Button title="Theek hai" onPress={() => setOpen(null)} />
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}
