import { useState } from 'react';
import { Text } from 'react-native';
import { useRouter } from 'expo-router';
import { errorMessage } from '../../api/errors';
import { useAuth } from '../../auth/AuthContext';
import { Card, ErrorText, Field, HintText, PrimaryButton, Screen } from '../../ui/components';

export default function RegisterScreen() {
  const { register } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const update = (key: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  async function onRegister() {
    setError(null);
    setLoading(true);
    try {
      await register({ ...form, email: form.email.trim(), phone: form.phone.trim() });
      router.push({ pathname: '/(auth)/verify-otp', params: { emailOrPhone: form.email.trim() } });
    } catch (err) {
      setError(errorMessage(err, 'Registration failed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <Card>
        <Text style={{ fontSize: 22, fontWeight: '700' }}>Create a passenger account</Text>
        <Field label="Name" value={form.name} onChangeText={update('name')} autoCapitalize="words" />
        <Field label="Email" value={form.email} onChangeText={update('email')} keyboardType="email-address" />
        <Field label="Phone" value={form.phone} onChangeText={update('phone')} keyboardType="phone-pad" />
        <Field label="Password" value={form.password} onChangeText={update('password')} secureTextEntry />
        <ErrorText message={error} />
        <PrimaryButton title="Register" onPress={onRegister} loading={loading} />
        <HintText>
          The activation code is printed in the user-service log: docker compose logs user-service | grep &quot;OTP for&quot;
        </HintText>
      </Card>
    </Screen>
  );
}
