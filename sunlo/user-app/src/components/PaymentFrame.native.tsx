import { WebView } from 'react-native-webview';
import { colors } from '@/theme';

/** Razorpay checkout server ke page par WebView mein; nateeja postMessage se app ko */
export function PaymentFrame({ url, onMessage }: { url: string; onMessage: (data: string) => void }) {
  return (
    <WebView
      source={{ uri: url }}
      onMessage={(e) => onMessage(e.nativeEvent.data)}
      style={{ flex: 1, backgroundColor: colors.bg }}
      javaScriptEnabled
      setSupportMultipleWindows={false}
      // Sirf hamara server aur Razorpay ke pages
      originWhitelist={['https://*', 'http://*']}
    />
  );
}
