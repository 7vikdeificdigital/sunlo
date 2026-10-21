import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { FlatList, KeyboardAvoidingView, Pressable, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKeyboardVisible } from '@/lib/useKeyboardVisible';
import { Header, Loader, Row, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { colors, font, radius, space } from '@/theme';

interface Detail {
  id: string;
  subject: string;
  status: 'OPEN' | 'CLOSED';
  messages: { id: string; body: string; isStaff: boolean; createdAt: string }[];
}

export default function TicketChat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const kbOpen = useKeyboardVisible();
  const q = useQuery({ queryKey: ['ticket', id], queryFn: () => api<Detail>(`/support/tickets/${id}`), refetchInterval: 15_000 });
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  async function send() {
    if (!text.trim()) return;
    setSending(true);
    try {
      await api(`/support/tickets/${id}/messages`, { method: 'POST', body: { message: text.trim() } });
      setText('');
      await q.refetch();
    } finally {
      setSending(false);
    }
  }

  return (
    <Screen edges={['top']}>
      <Header title={q.data?.subject ?? 'Ticket'} subtitle={q.data ? (q.data.status === 'OPEN' ? 'Team jald jawab degi' : 'Ticket band hai') : undefined} />
      {q.isLoading ? (
        <Loader />
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
          <FlatList
            data={q.data?.messages ?? []}
            keyExtractor={(m) => m.id}
            contentContainerStyle={{ padding: space.lg, gap: 8 }}
            renderItem={({ item }) => (
              <View style={{ alignSelf: item.isStaff ? 'flex-start' : 'flex-end', maxWidth: '82%', backgroundColor: item.isStaff ? colors.surface : colors.primarySoft, borderRadius: radius.lg, padding: 10 }}>
                {item.isStaff ? (
                  <Text variant="caption" color={colors.primaryDark}>
                    Support team
                  </Text>
                ) : null}
                <Text variant="body">{item.body}</Text>
                <Text variant="caption" style={{ alignSelf: 'flex-end' }}>
                  {formatDateTime(item.createdAt)}
                </Text>
              </View>
            )}
          />
          {q.data?.status === 'OPEN' ? (
            <Row style={{ padding: space.sm, paddingBottom: space.sm + (kbOpen ? 0 : insets.bottom), backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border }} gap={space.sm}>
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder="Likhein..."
                placeholderTextColor={colors.textFaint}
                multiline
                maxLength={2000}
                style={{ flex: 1, minHeight: 44, maxHeight: 110, backgroundColor: colors.surfaceAlt, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 11, fontFamily: font.regular, fontSize: 14.5, color: colors.text }}
              />
              <Pressable onPress={send} disabled={sending || !text.trim()} accessibilityLabel="Bhejein" style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: text.trim() ? colors.primary : colors.primaryTint, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="send" size={19} color={colors.white} />
              </Pressable>
            </Row>
          ) : null}
        </KeyboardAvoidingView>
      )}
    </Screen>
  );
}
