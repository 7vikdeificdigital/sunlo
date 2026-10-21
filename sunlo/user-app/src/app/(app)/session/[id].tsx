import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKeyboardVisible } from '@/lib/useKeyboardVisible';
import { Avatar } from '@/components/Avatar';
import { ReportSheet } from '@/components/ReportSheet';
import { NotStartedView, SummaryCard, WaitingView } from '@/components/SessionStates';
import { ErrorBox, Header, Loader, Row, Screen, Text } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatTime, mmss } from '@/lib/format';
import { emitAck, getSocket } from '@/lib/socket';
import type { ChatMessage } from '@/lib/types';
import { useLiveSession, useRemaining } from '@/lib/useLiveSession';
import { colors, font, radius, shadow, space } from '@/theme';

export default function ChatSession() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useLiveSession(id);
  const s = q.data;

  if (q.isLoading)
    return (
      <Screen>
        <Header title="Chat" />
        <Loader />
      </Screen>
    );
  if (!s)
    return (
      <Screen>
        <Header title="Chat" />
        <ErrorBox message={errorMessage(q.error)} onRetry={() => q.refetch()} />
      </Screen>
    );

  return (
    <Screen edges={['top']}>
      {s.status === 'REQUESTED' ? (
        <>
          <Header title="Connect ho raha hai" />
          <WaitingView s={s} />
        </>
      ) : s.status === 'ACTIVE' || s.status === 'COMPLETED' ? (
        <ChatRoom sessionId={id} />
      ) : (
        <>
          <Header title={s.vendor.displayName} />
          <NotStartedView s={s} />
        </>
      )}
    </Screen>
  );
}

function ChatRoom({ sessionId }: { sessionId: string }) {
  const insets = useSafeAreaInsets();
  const kbOpen = useKeyboardVisible();
  const qc = useQueryClient();
  const myId = useAuth((st) => st.user?.id);
  const { data: s } = useLiveSession(sessionId);
  const active = s?.status === 'ACTIVE';
  const remaining = useRemaining(s?.endsAt, active);
  const [text, setText] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [typing, setTyping] = useState(false);
  const [reporting, setReporting] = useState(false);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const lastTyping = useRef(0);

  const msgs = useQuery({ queryKey: ['messages', sessionId], queryFn: () => api<{ items: ChatMessage[] }>(`/sessions/${sessionId}/messages`) });

  useEffect(() => {
    const sock = getSocket();
    const onMsg = (m: ChatMessage) => {
      if (m.sessionId !== sessionId) return;
      qc.setQueryData<{ items: ChatMessage[] }>(['messages', sessionId], (old) => {
        const items = old?.items ?? [];
        if (items.some((x) => x.id === m.id)) return old;
        // apna optimistic message asli se badlo
        const idx = m.clientId ? items.findIndex((x) => x.clientId === m.clientId) : -1;
        if (idx >= 0) {
          const copy = [...items];
          copy[idx] = m;
          return { items: copy };
        }
        return { items: [...items, m] };
      });
      if (m.senderId !== myId) setTyping(false);
    };
    let typingTimer: ReturnType<typeof setTimeout>;
    const onTyping = (p: { sessionId: string; userId: string }) => {
      if (p.sessionId !== sessionId || p.userId === myId) return;
      setTyping(true);
      clearTimeout(typingTimer);
      typingTimer = setTimeout(() => setTyping(false), 3000);
    };
    sock.on('chat:message', onMsg);
    sock.on('chat:typing', onTyping);
    return () => {
      sock.off('chat:message', onMsg);
      sock.off('chat:typing', onTyping);
      clearTimeout(typingTimer);
    };
  }, [sessionId, qc, myId]);

  useEffect(() => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
  }, [msgs.data?.items.length]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  async function send() {
    const body = text.trim();
    if (!body || !active || !myId) return;
    setText('');
    const clientId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    qc.setQueryData<{ items: ChatMessage[] }>(['messages', sessionId], (old) => ({
      items: [...(old?.items ?? []), { id: clientId, clientId, senderId: myId, body, createdAt: new Date().toISOString(), pending: true }],
    }));
    const r = await emitAck<{ ok: boolean; error?: string; masked?: boolean }>('chat:send', { sessionId, body, clientId });
    if (!r.ok) {
      qc.setQueryData<{ items: ChatMessage[] }>(['messages', sessionId], (old) => ({ items: (old?.items ?? []).filter((m) => m.clientId !== clientId) }));
      setNotice(r.error ?? 'Message nahi gaya');
      setText(body);
    } else if (r.masked) {
      setNotice('Suraksha ke liye phone number / contact details chhupa di gayi hain.');
    }
  }

  function onChange(t: string) {
    setText(t);
    if (Date.now() - lastTyping.current > 2000) {
      lastTyping.current = Date.now();
      getSocket().emit('chat:typing', { sessionId });
    }
  }

  function end() {
    const doEnd = async () => {
      try {
        await api(`/sessions/${sessionId}/end`, { method: 'POST' });
      } catch (e) {
        setNotice(errorMessage(e));
      }
    };
    if (Platform.OS === 'web') {
      if (window.confirm('Chat khatam karein?')) void doEnd();
      return;
    }
    Alert.alert('Chat khatam karein?', 'Baat hue minuton ka hi paisa katega.', [
      { text: 'Nahi', style: 'cancel' },
      { text: 'Khatam karein', style: 'destructive', onPress: () => void doEnd() },
    ]);
  }

  if (!s) return null;
  const low = remaining !== null && remaining <= 120;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      {/* Header */}
      <Row style={{ paddingHorizontal: space.md, paddingVertical: space.sm, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }} gap={space.sm}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} hitSlop={10} style={{ padding: 4 }} accessibilityLabel="Peeche">
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Avatar name={s.vendor.displayName} uri={s.vendor.avatarUrl} size={38} status={active ? 'online' : undefined} />
        <View style={{ flex: 1 }}>
          <Text variant="title" numberOfLines={1}>
            {s.vendor.displayName}
          </Text>
          <Text variant="caption" color={typing ? colors.success : colors.textFaint}>
            {typing ? 'likh rahe hain...' : active ? 'Chat chal rahi hai' : 'Chat khatam'}
          </Text>
        </View>
        <Pressable onPress={() => setReporting(true)} hitSlop={8} accessibilityLabel="Report karein" style={{ padding: 4 }}>
          <Ionicons name="flag-outline" size={19} color={colors.textMuted} />
        </Pressable>
        {active ? (
          <>
            <View style={{ backgroundColor: low ? colors.dangerSoft : colors.primarySoft, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 }}>
              <Text style={{ fontFamily: font.semibold, fontSize: 13, color: low ? colors.danger : colors.primaryDark }}>{remaining !== null ? mmss(remaining) : '--:--'}</Text>
            </View>
            <Pressable onPress={end} style={{ backgroundColor: colors.danger, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6 }} accessibilityLabel="Chat khatam karein">
              <Text style={{ fontFamily: font.semibold, fontSize: 12.5, color: colors.white }}>End</Text>
            </Pressable>
          </>
        ) : null}
      </Row>

      {active && low ? (
        <Pressable onPress={() => router.push('/wallet')} style={{ backgroundColor: colors.dangerSoft, paddingHorizontal: space.lg, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Ionicons name="alert-circle" size={16} color={colors.danger} />
          <Text variant="small" color={colors.danger} style={{ flex: 1 }}>
            Balance kam hai. Recharge karein, chat ka samay apne aap badh jayega.
          </Text>
          <Text variant="label" color={colors.danger}>
            Recharge
          </Text>
        </Pressable>
      ) : null}

      <FlatList
        ref={listRef}
        data={msgs.data?.items ?? []}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: space.lg, gap: 8 }}
        ListHeaderComponent={
          <View style={{ alignSelf: 'center', backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: space.md, marginBottom: space.sm, maxWidth: 320 }}>
            <Text variant="caption" style={{ textAlign: 'center' }}>
              🔒 Yeh chat sirf aap dono dekh sakte hain. Phone number ya contact details share karna mana hai.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const mine = item.senderId === myId;
          return (
            <View
              style={{
                alignSelf: mine ? 'flex-end' : 'flex-start',
                maxWidth: '80%',
                backgroundColor: mine ? colors.primarySoft : colors.surface,
                borderRadius: radius.lg,
                borderBottomRightRadius: mine ? 4 : radius.lg,
                borderBottomLeftRadius: mine ? radius.lg : 4,
                paddingHorizontal: 12,
                paddingVertical: 8,
                opacity: item.pending ? 0.6 : 1,
                ...(mine ? {} : shadow.card),
              }}
            >
              <Text variant="body">{item.body}</Text>
              <Text variant="caption" style={{ alignSelf: 'flex-end', marginTop: 2 }}>
                {formatTime(item.createdAt)}
                {mine ? (item.pending ? ' · ⏳' : ' · ✓') : ''}
              </Text>
            </View>
          );
        }}
        ListFooterComponent={s.status === 'COMPLETED' ? <SummaryCard s={s} /> : null}
      />

      {notice ? (
        <Pressable onPress={() => setNotice(null)} style={{ marginHorizontal: space.lg, marginBottom: 6, backgroundColor: colors.text, borderRadius: radius.md, padding: 10 }}>
          <Text variant="small" color={colors.white}>
            {notice}
          </Text>
        </Pressable>
      ) : null}

      {active ? (
        <Row style={{ padding: space.sm, paddingBottom: space.sm + (kbOpen ? 0 : insets.bottom), backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border }} gap={space.sm}>
          <TextInput
            value={text}
            onChangeText={onChange}
            placeholder="Apna sawaal likhein..."
            placeholderTextColor={colors.textFaint}
            multiline
            maxLength={2000}
            style={{ flex: 1, maxHeight: 110, minHeight: 44, backgroundColor: colors.surfaceAlt, borderRadius: 22, paddingHorizontal: 16, paddingTop: 11, paddingBottom: 11, fontFamily: font.regular, fontSize: 14.5, color: colors.text }}
            accessibilityLabel="Message"
          />
          <Pressable
            onPress={send}
            disabled={!text.trim()}
            accessibilityLabel="Bhejein"
            style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: text.trim() ? colors.primary : colors.primaryTint, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="send" size={19} color={colors.white} />
          </Pressable>
        </Row>
      ) : (
        <View style={{ paddingBottom: insets.bottom }} />
      )}
      {reporting ? <ReportSheet vendorId={s.vendorId} sessionId={s.id} onClose={() => setReporting(false)} /> : null}
    </KeyboardAvoidingView>
  );
}
