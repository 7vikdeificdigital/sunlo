import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, ErrorBox, Header, Input, Loader, Row, Screen, Text } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { rupees } from '@/lib/format';
import { useAppConfig, useWallet } from '@/lib/queries';
import { colors, font, gradient, radius, shadow, space } from '@/theme';

export default function Wallet() {
  const insets = useSafeAreaInsets();
  const w = useWallet();
  const cfg = useAppConfig();
  const [packId, setPackId] = useState<string | null>(null);
  const [custom, setCustom] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const gstPct = cfg.data?.settings.gstPct ?? 18;
  const minRupees = (cfg.data?.settings.minRechargePaise ?? 5000) / 100;
  const pack = w.data?.packs.find((p) => p.id === packId);
  const customPaise = Math.round(Number(custom || 0) * 100);
  const amount = pack ? pack.amount : customPaise;
  const bonus = pack?.bonus ?? 0;
  const gst = pack ? pack.gstAmount : Math.round((customPaise * gstPct) / 100);
  const valid = pack ? true : Number(custom) >= minRupees;

  async function proceed() {
    setLoading(true);
    setError(null);
    try {
      const r = await api<{ paymentId: string; checkoutPath: string }>('/wallet/recharge', {
        method: 'POST',
        body: pack ? { packId: pack.id } : { amount: customPaise },
      });
      router.push({ pathname: '/payment', params: { paymentId: r.paymentId, path: r.checkoutPath } });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen edges={['top']}>
      <Header title="Wallet" right={<Button title="History" kind="ghost" size="sm" onPress={() => router.push('/history')} />} />
      {w.isLoading ? (
        <Loader />
      ) : w.isError ? (
        <ErrorBox message={errorMessage(w.error)} onRetry={() => w.refetch()} />
      ) : (
        <>
          <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: 200 }} keyboardShouldPersistTaps="handled">
            <LinearGradient colors={[...gradient]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: radius.xl, padding: space.xl, gap: 4 }}>
              <Text style={{ fontFamily: font.medium, fontSize: 13, color: 'rgba(255,255,255,0.9)' }}>Available balance</Text>
              <Text style={{ fontFamily: font.bold, fontSize: 32, color: colors.white }}>{rupees(w.data!.balance)}</Text>
              <Row gap={6} style={{ marginTop: 6 }}>
                <Ionicons name="shield-checkmark" size={14} color="rgba(255,255,255,0.9)" />
                <Text style={{ fontFamily: font.regular, fontSize: 12, color: 'rgba(255,255,255,0.9)' }}>100% secure payments</Text>
              </Row>
              <Ionicons name="wallet" size={80} color="rgba(255,255,255,0.15)" style={{ position: 'absolute', right: 16, top: 16 }} />
            </LinearGradient>

            <Text variant="h3">Recharge chunein</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
              {w.data!.packs.map((p) => {
                const on = p.id === packId;
                return (
                  <Pressable
                    key={p.id}
                    onPress={() => {
                      setPackId(p.id);
                      setCustom('');
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: on }}
                    style={{
                      width: '30.5%',
                      paddingVertical: space.lg,
                      borderRadius: radius.md,
                      alignItems: 'center',
                      backgroundColor: on ? colors.primarySoft : colors.surface,
                      borderWidth: 1.5,
                      borderColor: on ? colors.primary : colors.border,
                      ...shadow.card,
                    }}
                  >
                    {p.isPopular ? (
                      <View style={{ position: 'absolute', top: -9, backgroundColor: colors.primary, borderRadius: 6, paddingHorizontal: 6 }}>
                        <Text style={{ fontFamily: font.semibold, fontSize: 9.5, color: colors.white }}>POPULAR</Text>
                      </View>
                    ) : null}
                    <Text style={{ fontFamily: font.semibold, fontSize: 17 }}>{rupees(p.amount)}</Text>
                    {p.bonusPct ? (
                      <Text variant="caption" color={colors.success}>
                        +{p.bonusPct}% extra
                      </Text>
                    ) : (
                      <Text variant="caption"> </Text>
                    )}
                  </Pressable>
                );
              })}
            </View>

            <Input
              label={`Ya apni raqam likhein (kam se kam ₹${minRupees})`}
              value={custom}
              onChangeText={(t) => {
                setCustom(t.replace(/\D/g, '').slice(0, 6));
                setPackId(null);
              }}
              keyboardType="number-pad"
              placeholder="Amount"
              left={<Text variant="bodyStrong">₹</Text>}
            />
            {w.data!.provider === 'mock' ? (
              <View style={{ backgroundColor: '#EEE8FF', borderRadius: radius.md, padding: space.md }}>
                <Text variant="small" color="#5B3FD1">
                  Demo mode: asli paisa nahi katega. Server par Razorpay keys lagate hi asli payment chalu ho jayega.
                </Text>
              </View>
            ) : null}
          </ScrollView>

          {amount > 0 && valid ? (
            <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.surface, padding: space.lg, paddingBottom: space.lg + insets.bottom, gap: 6, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, ...shadow.raised }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text variant="small">Recharge</Text>
                <Text variant="bodyStrong">{rupees(amount)}</Text>
              </Row>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text variant="small">GST ({gstPct}%)</Text>
                <Text variant="bodyStrong">{rupees(gst)}</Text>
              </Row>
              {bonus ? (
                <Row style={{ justifyContent: 'space-between' }}>
                  <Text variant="small" color={colors.success}>
                    Bonus (wallet mein extra)
                  </Text>
                  <Text variant="bodyStrong" color={colors.success}>
                    +{rupees(bonus)}
                  </Text>
                </Row>
              ) : null}
              {error ? (
                <Text variant="small" color={colors.danger}>
                  {error}
                </Text>
              ) : null}
              <Button title={`${rupees(amount + gst)} pay karein`} onPress={proceed} loading={loading} style={{ marginTop: 6 }} />
            </View>
          ) : null}
        </>
      )}
    </Screen>
  );
}
