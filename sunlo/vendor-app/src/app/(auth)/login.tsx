import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, View } from 'react-native';
import { LogoMark } from '@/components/Logo';
import { Button, Input, Row, Screen, Text } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { sendLoginCode } from '@/lib/loginFlow';
import { brand, colors, font, gradient, radius, space } from '@/theme';

export default function Login() {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const digits = phone.replace(/\D/g, '');
  const valid = /^[6-9]\d{9}$/.test(digits);

  async function send() {
    if (!valid) return setError('10 ankon ka sahi mobile number dalein');
    setLoading(true);
    setError(undefined);
    const full = `+91${digits}`;
    try {
      await sendLoginCode(full);
      router.push({ pathname: '/otp', params: { phone: full } });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <LinearGradient colors={[...gradient]} style={{ paddingTop: 48, paddingBottom: 56, alignItems: 'center', borderBottomLeftRadius: 36, borderBottomRightRadius: 36 }}>
            <View style={{ width: 92, height: 92, borderRadius: 28, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' }}>
              <LogoMark size={66} />
            </View>
            <Text style={{ fontFamily: font.bold, fontSize: 28, color: colors.white, marginTop: 14 }}>{brand.name}</Text>
            <Text style={{ fontFamily: font.regular, fontSize: 14, color: 'rgba(255,255,255,0.92)', marginTop: 2 }}>Logon ki madad karein, ghar baithe kamayein</Text>
          </LinearGradient>

          <View style={{ padding: space.xl, gap: space.lg, marginTop: -28 }}>
            <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, padding: space.xl, gap: space.lg }}>
              <View>
                <Text variant="h2">Partner login</Text>
                <Text variant="small">Naye ho? Isi number se account ban jayega</Text>
              </View>
              <Input
                label="Mobile number"
                value={phone}
                onChangeText={(t) => {
                  setPhone(t.replace(/[^\d ]/g, '').slice(0, 11));
                  setError(undefined);
                }}
                keyboardType="phone-pad"
                autoComplete="tel"
                textContentType="telephoneNumber"
                placeholder="98765 43210"
                maxLength={11}
                error={error}
                onSubmitEditing={send}
                left={
                  <Row gap={6} style={{ paddingRight: 8, borderRightWidth: 1, borderRightColor: colors.border }}>
                    <Text variant="bodyStrong">🇮🇳 +91</Text>
                  </Row>
                }
              />
              <Button title="OTP bhejein" onPress={send} loading={loading} disabled={!valid} />
            </View>

            <Row gap={space.lg} style={{ justifyContent: 'center', marginTop: space.sm }}>
              {[
                { i: 'time-outline' as const, t: 'Apne samay par' },
                { i: 'cash-outline' as const, t: 'Har minute kamai' },
                { i: 'shield-checkmark-outline' as const, t: 'Surakshit payout' },
              ].map((x) => (
                <View key={x.t} style={{ alignItems: 'center', gap: 4, width: 92 }}>
                  <Ionicons name={x.i} size={22} color={colors.primaryDark} />
                  <Text variant="caption" style={{ textAlign: 'center' }}>
                    {x.t}
                  </Text>
                </View>
              ))}
            </Row>
            <Text variant="caption" style={{ textAlign: 'center', marginTop: space.md }}>
              Aage badhkar aap{' '}
              <Text variant="caption" color={colors.primary} onPress={() => router.push('/terms')} style={{ fontFamily: font.semibold }}>
                Partner Terms
              </Text>{' '}
              se sahmat hote hain
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
