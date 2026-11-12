import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Linking, Pressable, ScrollView, View } from 'react-native';
import { Button, Card, Header, Loader, Row, Screen, Text } from '@/components/ui';
import { useAppConfig } from '@/lib/queries';
import { colors, radius, space } from '@/theme';

/** IT Rules: Grievance Officer ka naam/sampark aur shikayat ka samay app mein saaf dikhana zaroori */
export default function Grievance() {
  const cfg = useAppConfig();
  const g = cfg.data?.grievance;
  if (!g) return <Screen><Header title="Grievance Officer" /><Loader /></Screen>;
  return (
    <Screen edges={['top']}>
      <Header title="Shikayat / Grievance Officer" />
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: space.xxl }}>
        <Card style={{ gap: space.sm }}>
          <Text variant="caption">Grievance Officer</Text>
          <Text variant="h3">{g.officerName || 'Bondty Grievance Team'}</Text>
          {g.email ? (
            <Pressable onPress={() => Linking.openURL(`mailto:${g.email}`)}>
              <Row gap={8}>
                <Ionicons name="mail-outline" size={18} color={colors.primaryDark} />
                <Text variant="bodyStrong" color={colors.primaryDark}>
                  {g.email}
                </Text>
              </Row>
            </Pressable>
          ) : null}
          {g.phone ? (
            <Pressable onPress={() => Linking.openURL(`tel:${g.phone.replace(/\s/g, '')}`)}>
              <Row gap={8}>
                <Ionicons name="call-outline" size={18} color={colors.primaryDark} />
                <Text variant="bodyStrong" color={colors.primaryDark}>
                  {g.phone}
                </Text>
              </Row>
            </Pressable>
          ) : null}
          {g.address ? <Text variant="small">{g.address}</Text> : null}
        </Card>
        <View style={{ backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: space.md, gap: 6 }}>
          <Text variant="title">Hum kab tak jawab denge</Text>
          <Text variant="small">• Shikayat milte hi ticket number ({g.acknowledgeWithinHours} ghante ke andar)</Text>
          <Text variant="small">• Aam shikayat ka samadhan {g.resolveWithinDays} din mein</Text>
          <Text variant="small">• Ashleel / ghair-kanooni content: {g.unlawfulContentWithinHours} ghante mein kaarvai</Text>
          <Text variant="small">• {g.appealNote}</Text>
        </View>
        <Button title="Shikayat darj karein" icon="create-outline" onPress={() => router.push({ pathname: '/support', params: { category: 'GRIEVANCE' } })} />
        <Button title="Ashleel / ghair-kanooni content ki report" kind="secondary" icon="alert-circle-outline" onPress={() => router.push({ pathname: '/support', params: { category: 'UNLAWFUL_CONTENT' } })} />
        <Text variant="caption" style={{ textAlign: 'center' }}>
          Niyam version {g.policyVersion}
        </Text>
      </ScrollView>
    </Screen>
  );
}
