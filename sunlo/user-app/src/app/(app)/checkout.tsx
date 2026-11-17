import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from 'react-native';
import { Coin, coinsOf } from '@/components/Coin';
import { Header, Loader, Row, Screen, Text } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { BILLING_MODE } from '@/lib/billing';
import { buyCoins } from '@/lib/playBilling';
import { rupees } from '@/lib/format';
import { qk, useAppConfig, useWallet } from '@/lib/queries';
import { colors, font, radius, shadow, space } from '@/theme';

type Method = { key: string; m: 'upi' | 'wallet' | 'card' | 'netbanking'; app?: string; label: string; sub?: string; icon: keyof typeof Ionicons.glyphMap; tint: string };

const UPI: Method[] = [
  { key: 'gpay', m: 'upi', app: 'google_pay', label: 'Google Pay', icon: 'logo-google', tint: '#2E6FD8' },
  { key: 'phonepe', m: 'upi', app: 'phonepe', label: 'PhonePe', icon: 'phone-portrait', tint: '#6B4CFF' },
  { key: 'paytm', m: 'upi', app: 'paytm', label: 'Paytm', icon: 'wallet', tint: '#1E9EDA' },
  { key: 'upi', m: 'upi', label: 'Other UPI apps', sub: 'BHIM, Amazon Pay, UPI ID', icon: 'apps', tint: '#1E9E5A' },
];
const OTHERS: Method[] = [
  { key: 'wallet', m: 'wallet', label: 'Wallets', sub: 'Mobikwik, Freecharge, Airtel & aur', icon: 'wallet-outline', tint: '#F2559F' },
  { key: 'card', m: 'card', label: 'Debit / Credit card', sub: 'Visa, Mastercard, RuPay', icon: 'card-outline', tint: '#5A3BEF' },
  { key: 'netbanking', m: 'netbanking', label: 'Net banking', sub: 'Saare major banks', icon: 'business-outline', tint: '#E5A100' },
];

export default function Checkout() {
  const { packId, amount } = useLocalSearchParams<{ packId?: string; amount?: string }>();
  const w = useWallet();
  const cfg = useAppConfig();
  const qc = useQueryClient();
  const userId = useAuth((st) => st.user?.id);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (w.isLoading) return (
    <Screen edges={['top']}>
      <Header title="Payment" />
      <Loader />
    </Screen>
  );

  const gstPct = cfg.data?.settings.gstPct ?? 18;
  const pack = packId ? w.data?.packs.find((p) => p.id === packId) : undefined;
  const base = pack ? pack.amount : Math.round(Number(amount ?? 0));
  const bonus = pack?.bonus ?? 0;
  const gst = pack ? pack.gstAmount : Math.round((base * gstPct) / 100);
  const total = base + gst;

  // Google Play se coins (sirf BILLING=both aur jab pack ke liye Play product ho)
  async function payPlay() {
    if (busy || !pack?.playProductId || !userId) return;
    setBusy('play');
    setError(null);
    try {
      const r = await buyCoins(pack.playProductId, userId);
      void qc.invalidateQueries({ queryKey: qk.me });
      void qc.invalidateQueries({ queryKey: qk.wallet });
      void qc.invalidateQueries({ queryKey: ['wallet', 'txns'] });
      Alert.alert(r.status === 'PAID' ? 'Recharge safal!' : 'Payment pending', r.status === 'PAID' ? 'Coins wallet mein jod diye gaye.' : 'Payment poora hote hi coins jud jayenge.', [{ text: 'OK', onPress: () => router.back() }]);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  async function pay(x: Method) {
    if (busy) return;
    setBusy(x.key);
    setError(null);
    try {
      const r = await api<{ paymentId: string; checkoutPath: string }>('/wallet/recharge', {
        method: 'POST',
        body: pack ? { packId: pack.id } : { amount: base },
      });
      const path = `${r.checkoutPath}&m=${x.m}${x.app ? `&a=${x.app}` : ''}`;
      router.push({ pathname: '/payment', params: { paymentId: r.paymentId, path } });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  if (!base) {
    return (
      <Screen edges={['top']}>
        <Header title="Payment" />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl }}>
          <Text variant="body" color={colors.textMuted}>Pehle recharge chunein.</Text>
        </View>
      </Screen>
    );
  }

  const Item = ({ x, last, onPress }: { x: Method; last: boolean; onPress?: () => void }) => (
    <Pressable
      onPress={onPress ?? (() => pay(x))}
      disabled={!!busy}
      accessibilityRole="button"
      accessibilityLabel={`${x.label} ${rupees(total)}`}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, paddingHorizontal: space.lg, borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.border, backgroundColor: pressed ? colors.surfaceAlt : colors.surface, opacity: busy && busy !== x.key ? 0.5 : 1 })}
    >
      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: `${x.tint}1A`, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={x.icon} size={20} color={x.tint} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong">{x.label}</Text>
        {x.sub ? <Text variant="caption" color={colors.textMuted}>{x.sub}</Text> : null}
      </View>
      {busy === x.key ? <ActivityIndicator color={colors.primary} /> : <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />}
    </Pressable>
  );

  const Group = ({ title, items }: { title: string; items: Method[] }) => (
    <View style={{ gap: space.sm }}>
      <Text style={{ fontFamily: font.semibold, fontSize: 12, letterSpacing: 0.8, color: colors.textMuted }}>{title}</Text>
      <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, ...shadow.card }}>
        {items.map((x, i) => <Item key={x.key} x={x} last={i === items.length - 1} />)}
      </View>
    </View>
  );

  return (
    <Screen edges={['top', 'bottom']}>
      <Header title="Payment" />
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: space.xxl }}>
        <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.lg, gap: space.sm, borderWidth: 1, borderColor: colors.border, ...shadow.card }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Row gap={8}>
              <Coin size={22} />
              <Text style={{ fontFamily: font.bold, fontSize: 20 }}>{coinsOf(base + bonus)}</Text>
              <Text variant="small" color={colors.textMuted}>coins milenge</Text>
            </Row>
            {pack?.bonusPct ? (
              <View style={{ backgroundColor: colors.successSoft, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 2 }}>
                <Text style={{ fontFamily: font.semibold, fontSize: 11, color: colors.success }}>{pack.bonusPct}% extra</Text>
              </View>
            ) : null}
          </Row>
          <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 4 }} />
          <Row style={{ justifyContent: 'space-between' }}>
            <Text variant="small" color={colors.textMuted}>Recharge</Text>
            <Text variant="small">{rupees(base)}</Text>
          </Row>
          {bonus ? (
            <Row style={{ justifyContent: 'space-between' }}>
              <Text variant="small" color={colors.success}>Bonus coins</Text>
              <Text variant="small" color={colors.success}>+{coinsOf(bonus)}</Text>
            </Row>
          ) : null}
          <Row style={{ justifyContent: 'space-between' }}>
            <Text variant="small" color={colors.textMuted}>GST ({gstPct}%)</Text>
            <Text variant="small">{rupees(gst)}</Text>
          </Row>
          <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 4 }} />
          <Row style={{ justifyContent: 'space-between' }}>
            <Text variant="bodyStrong">Final amount</Text>
            <Text style={{ fontFamily: font.bold, fontSize: 20, color: colors.primary }}>{rupees(total)}</Text>
          </Row>
        </View>

        {error ? (
          <View style={{ backgroundColor: colors.dangerSoft, borderRadius: radius.md, padding: space.md }}>
            <Text variant="small" color={colors.danger}>{error}</Text>
          </View>
        ) : null}
        {w.data?.provider === 'mock' ? (
          <View style={{ backgroundColor: '#EEE8FF', borderRadius: radius.md, padding: space.md }}>
            <Text variant="small" color="#5B3FD1">Demo mode: asli paisa nahi katega.</Text>
          </View>
        ) : null}

        <Group title="UPI SE PAY KAREIN" items={UPI} />
        <Group title="AUR TARIKE" items={OTHERS} />

        {BILLING_MODE === 'both' && pack?.playProductId ? (
          <View style={{ gap: space.sm }}>
            <Text style={{ fontFamily: font.semibold, fontSize: 12, letterSpacing: 0.8, color: colors.textMuted }}>GOOGLE PLAY</Text>
            <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, ...shadow.card }}>
              <Item x={{ key: 'play', m: 'upi', label: 'Google Play se pay karein', sub: 'Play Store ke payment tarike', icon: 'logo-google-playstore', tint: '#1E9E5A' }} last onPress={payPlay} />
            </View>
          </View>
        ) : null}

        <Row gap={6} style={{ justifyContent: 'center', marginTop: space.sm }}>
          <Ionicons name="lock-closed" size={13} color={colors.textMuted} />
          <Text variant="caption" color={colors.textMuted}>100% secure payment · Razorpay se</Text>
        </Row>
      </ScrollView>
    </Screen>
  );
}
