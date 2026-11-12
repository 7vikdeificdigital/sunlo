import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { space } from '@/theme';
import { Input, Row, Text } from './ui';

/** "YYYY-MM-DD" ho to aaj ki tareekh par 18+ hai ya nahi */
export function isAdult(dob: string, now = new Date()) {
  const [y, m, d] = dob.split('-').map(Number);
  const age = now.getFullYear() - y - (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d) ? 1 : 0);
  return age >= 18;
}

/** Janm-tithi: din / mahina / saal (bina extra library ke). Sahi tareekh hone par hi onChange mein "YYYY-MM-DD" */
export function DobInput({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  const [d, setD] = useState(value ? value.slice(8, 10) : '');
  const [m, setM] = useState(value ? value.slice(5, 7) : '');
  const [y, setY] = useState(value ? value.slice(0, 4) : '');
  useEffect(() => {
    const dd = Number(d);
    const mm = Number(m);
    const yy = Number(y);
    if (y.length === 4 && dd >= 1 && dd <= 31 && mm >= 1 && mm <= 12 && yy >= 1900) {
      const iso = `${yy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
      const dt = new Date(`${iso}T00:00:00Z`);
      onChange(!Number.isNaN(dt.getTime()) && dt.toISOString().slice(0, 10) === iso ? iso : null);
    } else onChange(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d, m, y]);
  const num = (setter: (v: string) => void, max: number) => (t: string) => setter(t.replace(/\D/g, '').slice(0, max));
  return (
    <View style={{ gap: 6 }}>
      <Text variant="label">Janm-tithi (18+ ki jaanch ke liye)</Text>
      <Row gap={space.sm}>
        <View style={{ flex: 1 }}>
          <Input value={d} onChangeText={num(setD, 2)} placeholder="DD" keyboardType="number-pad" maxLength={2} style={{ textAlign: 'center' }} accessibilityLabel="Din" />
        </View>
        <View style={{ flex: 1 }}>
          <Input value={m} onChangeText={num(setM, 2)} placeholder="MM" keyboardType="number-pad" maxLength={2} style={{ textAlign: 'center' }} accessibilityLabel="Mahina" />
        </View>
        <View style={{ flex: 1.4 }}>
          <Input value={y} onChangeText={num(setY, 4)} placeholder="YYYY" keyboardType="number-pad" maxLength={4} style={{ textAlign: 'center' }} accessibilityLabel="Saal" />
        </View>
      </Row>
      <Text variant="caption">Yeh sirf umar ki jaanch ke liye hai. Kisi listener ko nahi dikhti.</Text>
    </View>
  );
}
