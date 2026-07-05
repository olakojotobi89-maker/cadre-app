import { WebView } from 'react-native-webview';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HomeScreen() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <WebView
        source={{ uri: 'https://cadre-app.onrender.com' }}
        style={{ flex: 1 }}
      />
    </SafeAreaView>
  );
}