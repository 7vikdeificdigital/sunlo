import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { Button, Header, Screen, Text } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { sendLoginCode, verifyLoginCode, watchAutoVerify } from '@/lib/loginFlow';
import { colors, font, radius, space } from '@/theme';

export default function Otp() {
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wait, setWait] = useState(30);
  const input = useRef<TextInput>(null);
  const setTokens = useAuth((s) => s.setTokens);

  useEffect(() => {
    const t = setInterval(() => setWait((w) => (w > 0 ? w - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, []);

  // Firebase mode mein Android kabhi khud verify kar deta hai: tab OTP dalna nahi padta
  useEffect(() => watchAutoVerify((r) => void setTokens(r.accessToken, r.refreshToken)), [setTokens]);

  async function verify(c = code) {
    if (c.length !== 6) return;
    setLoading(true);
    setError(null);
    try {
      const r = await verifyLoginCode(phone, c);
      // Token save hote hi root layout khud app ke andar le jaata hai
      await setTokens(r.accessToken, r.refreshToken);
    } catch (e) {
      setError(errorMessage(e));
      setCode('');
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    setError(null);
    try {
      await sendLoginCode(phone, { resend: true });
      setWait(30);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <Header title="OTP verify karein" />
      <View style={{ padding: space.xl, gap: space.xl }}>
        <Text variant="body" color={colors.textMuted}>
          {phone} par bheja gaya 6 ankon ka OTP dalein
        </Text>
        <Pressable onPress={() => input.current?.focus()} style={{ flexDirection: 'row', gap: 10, justifyContent: 'center' }} accessibilityLabel="OTP dalein">
          {Array.from({ length: 6 }).map((_, i) => {
            const filled = code[i];
            const active = i === code.length;
            return (
              <View
                key={i}
                style={{
                  width: 46,
                  height: 54,
                  borderRadius: radius.md,
                  borderWidth: 1.5,
                  borderColor: active ? colors.primary : filled ? colors.primaryTint : colors.border,
                  backgroundColor: colors.surface,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontFamily: font.semibold, fontSize: 22 }}>{filled ?? ''}</Text>
              </View>
            );
          })}
        </Pressable>
        <TextInput
          ref={input}
          value={code}
          onChangeText={(t) => {
            const c = t.replace(/\D/g, '').slice(0, 6);
            setCode(c);
            if (c.length === 6) void verify(c);
          }}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="sms-otp"
          autoFocus
          maxLength={6}
          style={{ position: 'absolute', opacity: 0, height: 1, width: 1 }}
        />
        {error ? (
          <Text variant="small" color={colors.danger} style={{ textAlign: 'center' }}>
            {error}
          </Text>
        ) : null}
        <Button title="Verify karein" onPress={() => verify()} loading={loading} disabled={code.length !== 6} />
        <Pressable onPress={wait ? undefined : resend} disabled={!!wait} style={{ alignSelf: 'center' }}>
          <Text variant="label" color={wait ? colors.textFaint : colors.primaryDark}>
            {wait ? `Naya OTP ${wait}s baad` : 'OTP dobara bhejein'}
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}
