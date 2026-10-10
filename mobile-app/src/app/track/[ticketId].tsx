import { useEffect, useMemo, useRef } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { WebView } from 'react-native-webview';
import { useBusTracking } from '../../hooks/useBusTracking';
import { buildMapHtml, buildMoveScript } from '../../lib/mapHtml';
import { ErrorText } from '../../ui/components';
import { colors } from '../../ui/theme';

export default function TrackScreen() {
  const { ticketId } = useLocalSearchParams<{ ticketId: string }>();
  const state = useBusTracking(ticketId);
  const webRef = useRef<WebView>(null);
  const html = useMemo(() => buildMapHtml(), []);
  const position = state.phase === 'live' ? state.position : null;
  const latestScript = useRef<string | null>(null);

  useEffect(() => {
    if (!position) return;
    const script = buildMoveScript(position.lat, position.lon);
    latestScript.current = script;
    if (script) webRef.current?.injectJavaScript(script);
  }, [position]);

  return (
    <View style={styles.container}>
      <View style={styles.info}>
        {state.phase === 'loading' && <ActivityIndicator />}
        {state.phase === 'error' && <ErrorText message={state.message} />}
        {state.phase === 'live' && !position && (
          <Text style={styles.text}>Waiting for {state.vehicleReg} to report its location...</Text>
        )}
        {state.phase === 'live' && position && (
          <Text style={styles.text}>
            {state.vehicleReg} - {position.speedKmh.toFixed(0)} km/h - updated{' '}
            {new Date(position.timestamp).toLocaleTimeString()}
          </Text>
        )}
      </View>
      <WebView
        ref={webRef}
        style={styles.map}
        originWhitelist={['*']}
        source={{ html, baseUrl: 'https://transitlk.example' }}
        javaScriptEnabled
        onLoadEnd={() => {
          // the page may finish loading after the first position arrived
          if (latestScript.current) webRef.current?.injectJavaScript(latestScript.current);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  info: { padding: 12, minHeight: 48, justifyContent: 'center' },
  text: { color: colors.text, fontWeight: '600' },
  map: { flex: 1 },
});
