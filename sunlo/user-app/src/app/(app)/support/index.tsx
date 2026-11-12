import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Button, Card, Chip, Header, Input, Row, Screen, Text } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { colors, radius, space } from '@/theme';

interface Ticket {
  id: string;
  subject: string;
  status: 'OPEN' | 'CLOSED';
  updatedAt: string;
  ticketNo?: string;
  dueAt?: string | null;
  category?: string;
}

const CATEGORIES = [
  ['GENERAL', 'Aam sawaal'],
  ['PAYMENT', 'Payment / refund'],
  ['SAFETY', 'Listener ka vyavhar'],
  ['DATA', 'Mera data / privacy'],
  ['GRIEVANCE', 'Grievance (shikayat)'],
  ['UNLAWFUL_CONTENT', 'Ashleel / ghair-kanooni content'],
] as const;
type Cat = (typeof CATEGORIES)[number][0];

export default function Support() {
  const qc = useQueryClient();
  const faqs = useQuery({ queryKey: ['faqs'], queryFn: () => api<{ items: { q: string; a: string }[] }>('/support/faqs', { auth: false }) });
  const tickets = useQuery({ queryKey: ['tickets'], queryFn: () => api<{ items: Ticket[] }>('/support/tickets') });
  const [open, setOpen] = useState<number | null>(null);
  const params = useLocalSearchParams<{ category?: string }>();
  const initialCat = CATEGORIES.find((c) => c[0] === params.category)?.[0];
  const [creating, setCreating] = useState(Boolean(initialCat));
  const [category, setCategory] = useState<Cat>(initialCat ?? 'GENERAL');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function create() {
    if (subject.trim().length < 3 || !message.trim()) return setError('Vishay aur sandesh dono likhein');
    setSaving(true);
    setError(null);
    try {
      const t = await api<Ticket>('/support/tickets', { method: 'POST', body: { subject, message, category } });
      qc.invalidateQueries({ queryKey: ['tickets'] });
      setCreating(false);
      setSubject('');
      setMessage('');
      router.push(`/support/${t.id}`);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen edges={['top']}>
      <Header title="Help aur Support" />
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: space.xxl }} keyboardShouldPersistTaps="handled">
        <Text variant="h3">Aksar poochhe jaane wale sawaal</Text>
        <Card style={{ padding: 0 }}>
          {faqs.data?.items.map((f, i) => (
            <Pressable key={f.q} onPress={() => setOpen(open === i ? null : i)} style={{ padding: space.lg, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border, gap: 6 }}>
              <Row style={{ justifyContent: 'space-between' }} gap={space.md}>
                <Text variant="bodyStrong" style={{ flex: 1 }}>
                  {f.q}
                </Text>
                <Ionicons name={open === i ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
              </Row>
              {open === i ? <Text variant="small">{f.a}</Text> : null}
            </Pressable>
          ))}
        </Card>

        <Row style={{ justifyContent: 'space-between' }}>
          <Text variant="h3">Mere tickets</Text>
          {!creating ? <Button title="Naya ticket" icon="add" size="sm" onPress={() => setCreating(true)} /> : null}
        </Row>
        {creating ? (
          <Card style={{ gap: space.md }}>
            <View style={{ gap: 6 }}>
              <Text variant="label">Kis baare mein?</Text>
              <Row gap={6} style={{ flexWrap: 'wrap' }}>
                {CATEGORIES.map(([c, l]) => (
                  <Chip key={c} label={l} active={category === c} onPress={() => setCategory(c)} />
                ))}
              </Row>
              <Text variant="caption">
                {category === 'UNLAWFUL_CONTENT' ? '36 ghante mein kaarvai. Ticket number turant milega.' : '7 din mein samadhan. Ticket number turant milega.'}
              </Text>
            </View>
            <Input label="Vishay" value={subject} onChangeText={setSubject} maxLength={120} placeholder="Jaise: Recharge ka paisa nahi aaya" />
            <Input label="Poori baat" value={message} onChangeText={setMessage} maxLength={2000} multiline style={{ minHeight: 90, textAlignVertical: 'top' }} />
            {error ? (
              <Text variant="small" color={colors.danger}>
                {error}
              </Text>
            ) : null}
            <Row gap={space.md}>
              <Button title="Cancel" kind="ghost" style={{ flex: 1 }} onPress={() => setCreating(false)} />
              <Button title="Bhejein" style={{ flex: 1 }} loading={saving} onPress={create} />
            </Row>
          </Card>
        ) : null}
        {tickets.data?.items.length ? (
          tickets.data.items.map((t) => (
            <Card key={t.id} onPress={() => router.push(`/support/${t.id}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong">{t.subject}</Text>
                <Text variant="caption">
                  {t.ticketNo ? `${t.ticketNo} · ` : ''}
                  {formatDateTime(t.updatedAt)}
                  {t.status === 'OPEN' && t.dueAt ? ` · jawab ${formatDateTime(t.dueAt)} tak` : ''}
                </Text>
              </View>
              <View style={{ backgroundColor: t.status === 'OPEN' ? colors.successSoft : colors.surfaceAlt, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 }}>
                <Text variant="caption" color={t.status === 'OPEN' ? colors.success : colors.textMuted}>
                  {t.status === 'OPEN' ? 'Khula' : 'Band'}
                </Text>
              </View>
            </Card>
          ))
        ) : !creating ? (
          <Text variant="small">Koi ticket nahi. Dikkat ho to naya ticket banayein.</Text>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
