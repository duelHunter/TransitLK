import { useState } from 'react';
import { Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { errorMessage } from '../../api/errors';
import { useAuth } from '../../auth/AuthContext';
import { Card, ErrorText, Field, HintText, PrimaryButton, Screen } from '../../ui/components';

export default function VerifyOtpScreen() {
  const { verifyOtp } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ emailOrPhone: string }>();
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onVerify() {
    setError(null);
    setLoading(true);
    try {
      await verifyOtp(params.emailOrPhone, otp.trim());
      router.replace('/(tabs)/book');
    } catch (err) {
      setError(errorMessage(err, 'Verification failed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <Card>
        <Text style={{ fontSize: 22, fontWeight: '700' }}>Enter your code</Text>
        <HintText>Account: {params.emailOrPhone}</HintText>
        <Field label="6-digit code" value={otp} onChangeText={setOtp} keyboardType="number-pad" maxLength={6} />
        <ErrorText message={error} />
        <PrimaryButton title="Verify and sign in" onPress={onVerify} loading={loading} />
      </Card>
    </Screen>
  );
}
