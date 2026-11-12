import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, Share, View } from 'react-native';
import { Button, Card, Header, Row, Screen, Text } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDateTime } from '@/lib/format';
import { useAppConfig, useMe } from '@/lib/queries';
import { disconnectSocket } from '@/lib/socket';
import { colors, radius, space } from '@/theme';

function confirm(title: string, msg: string, ok: string, fn: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${msg}`)) fn();
    return;
  }
  Alert.alert(title, msg, [
    { text: 'Nahi', style: 'cancel' },
    { text: ok, style: 'destructive', onPress: fn },
  ]);
}

/** DPDP: apna data dekhna/lena, sahmati wapas lena (= sab mitana), chat kitne din rehti hai */
export default function Privacy() {
  const me = useMe();
  const cfg = useAppConfig();
  const signOut = useAuth((s) => s.signOut);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const u = me.data?.user;

  async function exportData() {
    setBusy(true);
    setMsg(null);
    try {
      const data = await api<object>('/me/export');
      const json = JSON.stringify(data, null, 2);
      if (Platform.OS === 'web') {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
        a.download = `bondty-data-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
      } else {
        await Share.share({ title: 'Mera Bondty data', message: json });
      }
      setMsg('Aapka data taiyaar hai.');
    } catch (e) {
      setMsg(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen edges={['top']}>
      <Header title="Data aur privacy" />
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: space.xxl }}>
        <Card style={{ gap: 6 }}>
          <Row gap={8}>
            <Ionicons name="shield-checkmark-outline" size={20} color={colors.success} />
            <Text variant="title">Aapki baat aapki hai</Text>
          </Row>
          <Text variant="small">• Call record nahi hoti.</Text>
          <Text variant="small">• Chat {cfg.data?.settings.chatRetentionDays ?? 90} din baad apne aap mit jaati hai (sirf jis par shikayat chal rahi ho, woh jaanch tak rehti hai).</Text>
          <Text variant="small">• Phone number aur email chat mein apne aap chhup jaate hain.</Text>
          <Text variant="small">• Aapki baatein ads ke liye kabhi use nahi hoti.</Text>
          {u?.consentAt ? <Text variant="caption">Privacy notice (version {u.consentVersion}) par sahmati: {formatDateTime(u.consentAt)}</Text> : null}
        </Card>

        <Card style={{ gap: space.sm }}>
          <Text variant="title">Mera data mujhe do</Text>
          <Text variant="small">Profile, wallet, payments, sessions, apne messages, check-ins: sab ek file mein.</Text>
          <Button title="Data download karein" icon="download-outline" kind="secondary" loading={busy} onPress={exportData} />
          {msg ? <Text variant="small">{msg}</Text> : null}
        </Card>

        <View style={{ borderRadius: radius.md, borderWidth: 1, borderColor: colors.dangerSoft, padding: space.lg, gap: space.sm }}>
          <Text variant="title" color={colors.danger}>
            Sahmati wapas lein (sab mitayein)
          </Text>
          <Text variant="small">
            Isse aapka account aur personal jaankari (naam, number, check-ins, bookings) mita di jayegi. Payment aur tax ka hisaab kanoon ke liye bina naam ke rehta hai. Wallet ka bacha balance wapas nahi milega.
          </Text>
          <Pressable
            onPress={() =>
              confirm('Sab mita dein?', 'Yeh wapas nahi ho sakta.', 'Haan, mita do', async () => {
                await api('/me/consent/withdraw', { method: 'POST', body: { confirm: true } });
                disconnectSocket();
                await signOut();
              })
            }
            accessibilityRole="button"
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 }}
          >
            <Ionicons name="trash-outline" size={18} color={colors.danger} />
            <Text variant="bodyStrong" color={colors.danger}>
              Sahmati wapas lein aur account mitayein
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </Screen>
  );
}
