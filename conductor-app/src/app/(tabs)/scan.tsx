import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { isAxiosError } from 'axios';
import { useFocusEffect } from 'expo-router';
import { api } from '../../api/client';
import { errorMessage, isUnreachable } from '../../api/errors';
import type { ValidationResult } from '../../api/types';
import { TICKET_SIGNING_SECRET } from '../../config';
import { RedeemQueue } from '../../lib/redeemQueue';
import type { RedeemOutcome } from '../../lib/redeemQueue';
import { verifyTicketSignature } from '../../lib/ticketSignature';
import { Card, HintText, PrimaryButton, Screen } from '../../ui/components';
import { colors } from '../../ui/theme';

interface ScanResult {
  kind: 'valid' | 'invalid' | 'error';
  title: string;
  detail: string;
}

/** The server's answer, or a thrown error when it cannot be reached (so the queue keeps the ticket). */
async function redeemOnline(qrCode: string): Promise<{ valid: boolean; reason: string }> {
  try {
    const { data } = await api.post<ValidationResult>('/api/tickets/validate', { qrCode });
    return { valid: data.valid, reason: data.reason };
  } catch (err) {
    if (isAxiosError(err) && err.response && err.response.status < 500 && err.response.status !== 401) {
      return { valid: false, reason: err.response.data?.message ?? err.message };
    }
    throw err;
  }
}

export default function ScanScreen() {
  const queue = useMemo(() => new RedeemQueue(AsyncStorage, redeemOnline), []);
  const [permission, requestPermission] = useCameraPermissions();
  const [focused, setFocused] = useState(false);
  const [cameraOn, setCameraOn] = useState(true);
  const [busy, setBusy] = useState(false);
  const [offlineMode, setOfflineMode] = useState(false);
  const [pending, setPending] = useState(0);
  const [synced, setSynced] = useState<RedeemOutcome[]>([]);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [manual, setManual] = useState('');

  // Only one camera preview may be live, so mount it only while this tab is focused.
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  const refreshPending = useCallback(async () => {
    setPending((await queue.pending()).length);
  }, [queue]);

  useEffect(() => {
    refreshPending();
  }, [refreshPending]);

  // Redeem accepted-offline boardings whenever the server is reachable again.
  useEffect(() => {
    if (offlineMode) return;
    let cancelled = false;
    async function sync() {
      const outcomes = await queue.flush();
      if (cancelled) return;
      if (outcomes.length > 0) setSynced((prev) => [...outcomes, ...prev].slice(0, 5));
      await refreshPending();
    }
    sync();
    const timer = setInterval(sync, 5000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [offlineMode, queue, refreshPending]);

  async function acceptOffline(ticket: string) {
    const check = TICKET_SIGNING_SECRET
      ? verifyTicketSignature(ticket, TICKET_SIGNING_SECRET)
      : { ok: false, reason: 'Offline verification is not configured', ticketId: undefined };
    if (!check.ok) {
      setResult({ kind: 'invalid', title: 'INVALID', detail: check.reason });
      return;
    }
    if (!(await queue.enqueue(ticket))) {
      setResult({ kind: 'invalid', title: 'INVALID', detail: 'Already scanned on this phone' });
      return;
    }
    await refreshPending();
    setResult({
      kind: 'valid',
      title: 'VALID - boarding allowed',
      detail: 'Signature checked on this phone. It will be recorded when the connection returns.',
    });
  }

  async function validate(raw: string) {
    const ticket = raw.trim();
    if (!ticket || busy) return;
    setBusy(true);
    setCameraOn(false);
    setResult(null);
    try {
      if (!offlineMode) {
        try {
          const { data } = await api.post<ValidationResult>('/api/tickets/validate', { qrCode: ticket });
          setResult({
            kind: data.valid ? 'valid' : 'invalid',
            title: data.valid ? 'VALID - boarding allowed' : 'INVALID',
            detail: data.valid && data.seatNo != null ? `Seat ${data.seatNo}` : data.reason,
          });
          return;
        } catch (err) {
          if (!isUnreachable(err)) {
            setResult({ kind: 'error', title: 'ERROR', detail: errorMessage(err, 'Validation failed') });
            return;
          }
        }
      }
      await acceptOffline(ticket);
    } finally {
      setBusy(false);
      setManual('');
    }
  }

  function scanNext() {
    setResult(null);
    setCameraOn(true);
  }

  const color = result?.kind === 'valid' ? colors.success : colors.error;

  return (
    <Screen>
      <Card>
        <View style={styles.row}>
          <Text style={styles.label}>Simulate offline (no server contact)</Text>
          <Switch value={offlineMode} onValueChange={setOfflineMode} />
        </View>
        {pending > 0 && (
          <HintText>
            {pending} boarding{pending === 1 ? '' : 's'} accepted offline, waiting to sync.
          </HintText>
        )}
      </Card>

      {result ? (
        <Card>
          <Text style={[styles.resultTitle, { color }]}>{result.title}</Text>
          <Text>{result.detail}</Text>
          <PrimaryButton title="Scan next ticket" onPress={scanNext} />
        </Card>
      ) : !permission ? null : !permission.granted ? (
        <Card>
          <Text>Camera access is needed to scan passenger tickets.</Text>
          <PrimaryButton title="Allow camera" onPress={() => requestPermission()} />
        </Card>
      ) : focused && cameraOn ? (
        <View style={styles.cameraBox}>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={(scan) => validate(scan.data)}
          />
        </View>
      ) : null}

      <Card>
        <Text style={styles.label}>Camera not working? Paste the ticket code</Text>
        <TextInput
          style={styles.input}
          value={manual}
          onChangeText={setManual}
          placeholder="Signed ticket code"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          autoCorrect={false}
          multiline
        />
        <PrimaryButton title="Validate pasted code" onPress={() => validate(manual)} loading={busy} secondary />
      </Card>

      {synced.map((s) => (
        <Text key={s.qrCode} style={{ color: s.valid ? colors.success : colors.error }}>
          Synced: {s.valid ? 'recorded' : `rejected - ${s.reason}`}
        </Text>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  label: { color: colors.text, fontWeight: '600', flexShrink: 1 },
  cameraBox: { height: 320, borderRadius: 12, overflow: 'hidden', backgroundColor: '#000' },
  resultTitle: { fontSize: 20, fontWeight: '800' },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 10,
    minHeight: 70,
    color: colors.text,
  },
});
