import { useState } from 'react';
import { Text } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { errorMessage } from '../../api/errors';
import { useAuth } from '../../auth/AuthContext';
import { Card, ErrorText, Field, HintText, PrimaryButton, Screen } from '../../ui/components';

export default function LoginScreen() {
  const { login, sessionExpired } = useAuth();
  const router = useRouter();
  // Prefilled with the seeded demo passenger so the demo needs no typing.
  const [emailOrPhone, setEmailOrPhone] = useState('passenger@transitlk.lk');
  const [password, setPassword] = useState('demo1234');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onLogin() {
    setError(null);
    setLoading(true);
    try {
      await login(emailOrPhone.trim(), password);
      router.replace('/(tabs)/book');
    } catch (err) {
      setError(errorMessage(err, 'Login failed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <Card>
        <Text style={{ fontSize: 22, fontWeight: '700' }}>Sign in</Text>
        <Field label="Email or phone" value={emailOrPhone} onChangeText={setEmailOrPhone} keyboardType="email-address" />
        <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry />
        <ErrorText message={error ?? (sessionExpired ? 'Your session has expired. Please sign in again.' : null)} />
        <PrimaryButton title="Sign in" onPress={onLogin} loading={loading} />
        <HintText>Demo passenger is prefilled.</HintText>
      </Card>
      <Link href="/(auth)/register" style={{ textAlign: 'center' }}>
        No account? Register
      </Link>
    </Screen>
  );
}
