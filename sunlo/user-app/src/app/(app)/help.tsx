import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Linking, Pressable, ScrollView, View } from 'react-native';
import { Card, Header, Row, Screen, Text } from '@/components/ui';
import { useAppConfig } from '@/lib/queries';
import { colors, font, radius, space } from '@/theme';

/**
 * Mushkil waqt mein madad. Listeners doctor/therapist nahi hain: yeh screen saaf batati hai
 * ki khatre ki sthiti mein turant professional/sarkari madad kahan milegi.
 */
export default function Help() {
  const cfg = useAppConfig();
  const lines = cfg.data?.helplines ?? [
    { name: 'Tele-MANAS (Bharat Sarkar)', phone: '14416', note: '24x7, muft, kai bhashaon mein' },
    { name: 'Emergency', phone: '112', note: 'Turant khatra ho to' },
  ];
  return (
    <Screen edges={['top']}>
      <Header title="Madad" />
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: space.xxl }}>
        <View style={{ backgroundColor: colors.accentSoft, borderRadius: radius.lg, padding: space.lg, gap: 6 }}>
          <Text variant="h3">Aap akele nahi hain</Text>
          <Text variant="body" color={colors.textMuted}>
            Agar aap ya koi apna khud ko nuksan pahunchane ke baare mein soch raha hai, ya turant khatra hai, to abhi neeche diye number par call karein. Wahan trained log aapki madad karenge.
          </Text>
        </View>
        {lines.map((h) => (
          <Pressable key={h.phone} onPress={() => Linking.openURL(`tel:${h.phone}`)} accessibilityRole="button" accessibilityLabel={`${h.name} ko call karein`}>
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="call" size={22} color={colors.primaryDark} />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="title">{h.name}</Text>
                <Text variant="small">{h.note}</Text>
              </View>
              <Text style={{ fontFamily: font.bold, fontSize: 20, color: colors.primaryDark }}>{h.phone}</Text>
            </Card>
          </Pressable>
        ))}
        <Card style={{ gap: 8 }}>
          <Row gap={8}>
            <Ionicons name="information-circle-outline" size={18} color={colors.textMuted} />
            <Text variant="title">Sunlo ke baare mein</Text>
          </Row>
          <Text variant="small">
            Sunlo par Listeners aapki baat sunne aur saath dene ke liye hain; woh doctor, psychiatrist ya therapist nahi hain aur ilaaj ya dawa ki salah nahi dete. Experts apne field (career, legal, finance...) mein salah dete hain.
          </Text>
          <Pressable onPress={() => router.push('/support')}>
            <Text variant="label" color={colors.primaryDark}>
              Kisi profile ki shikayat ya app ki dikkat? Support se baat karein →
            </Text>
          </Pressable>
        </Card>
      </ScrollView>
    </Screen>
  );
}
