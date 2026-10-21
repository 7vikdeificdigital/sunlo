import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { View } from 'react-native';
import { PaymentFrame } from '@/components/PaymentFrame';
import { Button, Header, Loader, Screen, Text } from '@/components/ui';
import { api, API_URL, errorMessage } from '@/lib/api';
import { qk } from '@/lib/queries';
import { colors, space } from '@/theme';

type Msg = { type: string; paymentId: string; result: 'success' | 'failure' | 'dismissed' | 'closed'; providerPaymentId?: string; signature?: string; mockResult?: 'success' | 'failure' };

export default function Payment() {
  const { paymentId, path } = useLocalSearchParams<{ paymentId: string; path: string }>();
  const qc = useQueryClient();
  const [state, setState] = useState<'paying' | 'verifying' | 'success' | 'failed'>('paying');
  const [message, setMessage] = useState<string | null>(null);
  const handled = useRef(false);

  const onMessage = useCallback(
    async (raw: string) => {
      let m: Msg;
      try {
        m = JSON.parse(raw);
      } catch {
        return;
      }
      if (m.type !== 'sunlo-payment' || m.paymentId !== paymentId || handled.current) return;
      if (m.result === 'dismissed') return; // user ne Razorpay band kiya; page par "Pay Now" phir se hai
      handled.current = true;
      if (m.result !== 'success') {
        if (m.mockResult === 'failure') await api('/wallet/recharge/verify', { method: 'POST', body: { paymentId, mockResult: 'failure' } }).catch(() => undefined);
        setState('failed');
        setMessage('Payment poora nahi hua. Agar paisa kata hai to 5-7 din mein wapas aa jayega.');
        return;
      }
      setState('verifying');
      try {
        // Paisa wallet mein tabhi judta hai jab server khud verify kare
        const r = await api<{ status: string }>('/wallet/recharge/verify', {
          method: 'POST',
          body: { paymentId, providerPaymentId: m.providerPaymentId, signature: m.signature, mockResult: m.mockResult },
        });
        if (r.status === 'PAID') {
          setState('success');
          qc.invalidateQueries({ queryKey: qk.me });
          qc.invalidateQueries({ queryKey: qk.wallet });
          qc.invalidateQueries({ queryKey: ['wallet', 'txns'] });
        } else {
          setState('failed');
          setMessage('Payment poora nahi hua.');
        }
      } catch (e) {
        setState('failed');
        setMessage(errorMessage(e));
      }
    },
    [paymentId, qc],
  );

  if (!path) return null;
  const url = `${API_URL}${path}`;

  return (
    <Screen edges={['top', 'bottom']}>
      <Header title="Payment" />
      {state === 'paying' ? (
        <PaymentFrame url={url} onMessage={onMessage} />
      ) : state === 'verifying' ? (
        <Loader label="Payment verify ho raha hai..." />
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xxl, gap: space.md }}>
          <View style={{ width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center', backgroundColor: state === 'success' ? colors.successSoft : colors.dangerSoft }}>
            <Ionicons name={state === 'success' ? 'checkmark' : 'close'} size={44} color={state === 'success' ? colors.success : colors.danger} />
          </View>
          <Text variant="h2">{state === 'success' ? 'Recharge safal!' : 'Payment fail'}</Text>
          <Text variant="body" color={colors.textMuted} style={{ textAlign: 'center' }}>
            {state === 'success' ? 'Paise aapke wallet mein jod diye gaye hain.' : message}
          </Text>
          <Button title={state === 'success' ? 'Ab baat karein' : 'Dobara koshish karein'} onPress={() => (state === 'success' ? router.replace('/chat') : router.back())} style={{ alignSelf: 'stretch', marginTop: space.md }} />
          {state === 'success' ? <Button title="Wallet par wapas" kind="ghost" onPress={() => router.back()} style={{ alignSelf: 'stretch' }} /> : null}
        </View>
      )}
    </Screen>
  );
}
