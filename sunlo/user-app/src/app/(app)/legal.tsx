import { ScrollView, View } from 'react-native';
import { Card, Header, Screen, Text } from '@/components/ui';
import { LAST_UPDATED, TERMS_INTRO, TERMS_SECTIONS } from '@/lib/legalText';
import { space } from '@/theme';

/** Login ke baad bhi Terms + Privacy padhne ke liye */
export default function Legal() {
  return (
    <Screen edges={['top']}>
      <Header title="Terms aur Privacy" subtitle={`Last updated: ${LAST_UPDATED}`} />
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: space.xxl }}>
        <Text variant="small">{TERMS_INTRO}</Text>
        {TERMS_SECTIONS.map((sec, i) => (
          <Card key={sec.title} style={{ gap: 6 }}>
            <Text variant="title">
              {i + 1}. {sec.title}
            </Text>
            {sec.points.map((p) => (
              <View key={p} style={{ flexDirection: 'row', gap: 6 }}>
                <Text variant="small">•</Text>
                <Text variant="small" style={{ flex: 1 }}>
                  {p}
                </Text>
              </View>
            ))}
          </Card>
        ))}
      </ScrollView>
    </Screen>
  );
}
