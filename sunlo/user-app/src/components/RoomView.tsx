import { View } from 'react-native';
import { font } from '@/theme';
import { Text } from './ui';
import type { RoomViewProps } from './RoomView.native';

/** Web preview: room ki awaaz/video sirf Android/iOS app mein chalti hai */
export function RoomView(_: RoomViewProps) {
  return (
    <View style={{ position: 'absolute', left: 0, right: 0, top: 120, alignItems: 'center', paddingHorizontal: 30 }}>
      <Text style={{ color: 'rgba(255,255,255,0.8)', textAlign: 'center', fontFamily: font.medium, fontSize: 12.5 }}>Awaaz/video sirf mobile app mein chalti hai (yeh web preview hai).</Text>
    </View>
  );
}
