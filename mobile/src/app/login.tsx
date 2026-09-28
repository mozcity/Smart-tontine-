import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Button, Field, colors, notifyError } from '@/components/ui';

export default function Login() {
  const { signIn } = useAuth();
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('+226');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [referral, setReferral] = useState('');
  const [hint, setHint] = useState('');
  const [loading, setLoading] = useState(false);

  async function requestCode() {
    setLoading(true);
    try {
      const r = await api<{ devCode?: string }>('/auth/otp/request', { body: { phone: phone.replace(/\s/g, '') } });
      setHint(r.devCode ? `Code de test : ${r.devCode}` : 'Un code t\'a été envoyé par SMS.');
      setStep('code');
    } catch (e) { notifyError(e); } finally { setLoading(false); }
  }

  async function verify() {
    setLoading(true);
    try {
      const r = await api<{ token: string }>('/auth/otp/verify', {
        body: { phone: phone.replace(/\s/g, ''), code, fullName: name || undefined, referralCode: referral || undefined, channel: 'app' },
      });
      await signIn(r.token);
    } catch (e) { notifyError(e); } finally { setLoading(false); }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.brand }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
        <Text style={{ color: '#fff', fontSize: 34, fontWeight: '900', letterSpacing: 1 }}>Smart Tontine</Text>
        <View style={{ backgroundColor: colors.green, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, marginTop: 12 }}>
          <Text style={{ color: '#fff', fontSize: 20, fontWeight: '800' }}>Gère ton argent</Text>
        </View>
        <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700', marginTop: 4 }}>sans stress, depuis ton téléphone</Text>

        <View style={{ backgroundColor: '#fff', borderRadius: 20, padding: 20, gap: 14, marginTop: 32 }}>
          {step === 'phone' ? (
            <>
              <Field label="Numéro de téléphone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" />
              <Button title="Recevoir mon code" onPress={requestCode} loading={loading} variant="green" />
            </>
          ) : (
            <>
              <Text style={{ color: colors.ink2 }}>{hint}</Text>
              <Field label="Code à 6 chiffres" value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} autoComplete="sms-otp" />
              <Field label="Ton prénom et nom (nouveau compte)" value={name} onChangeText={setName} />
              <Field label="Code parrain (facultatif)" value={referral} onChangeText={setReferral} autoCapitalize="characters" />
              <Button title="Continuer" onPress={verify} loading={loading} variant="green" disabled={code.length !== 6} />
              <Button title="Changer de numéro" onPress={() => setStep('phone')} variant="ghost" />
            </>
          )}
        </View>
        <Text style={{ color: '#C9C8F0', fontSize: 12, marginTop: 16, textAlign: 'center' }}>
          En continuant, tu acceptes les conditions d'utilisation et la politique de confidentialité Smart Tontine.
        </Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
