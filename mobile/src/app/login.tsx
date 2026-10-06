import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowRight, ShieldCheck, Smartphone, TrendingUp } from 'lucide-react-native';
import { api, tokenStore, type SessionTokens } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Button, Field, colors, notifyError, type Icon } from '@/components/ui';

const PROMISES: [Icon, string][] = [
  [ShieldCheck, 'Une caution protège le groupe contre les impayés'],
  [Smartphone, 'Cotise par Orange Money, Moov Money ou Wave'],
  [TrendingUp, 'Ta régularité t’ouvre le crédit'],
];

export default function Login() {
  const { signIn } = useAuth();
  const [step, setStep] = useState<'phone' | 'code' | 'name'>('phone');
  // Session obtenue mais compte sans nom : le nom est demandé avant d'entrer dans l'app.
  const [pending, setPending] = useState<SessionTokens | null>(null);
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
      setHint(r.devCode ? `Mode démo : ton code est ${r.devCode}` : `Code envoyé par SMS au ${phone}.`);
      setStep('code');
    } catch (e) { notifyError(e); } finally { setLoading(false); }
  }

  async function verify() {
    setLoading(true);
    try {
      const r = await api<{ token: string; refreshToken?: string }>('/auth/otp/verify', {
        body: { phone: phone.replace(/\s/g, ''), code, fullName: name || undefined, referralCode: referral || undefined, channel: 'app' },
      });
      await tokenStore.save(r);
      const me = await api<{ full_name: string | null }>('/auth/me');
      if (!me.full_name) { setPending(r); setStep('name'); return; }
      await signIn(r);
    } catch (e) { notifyError(e); } finally { setLoading(false); }
  }

  async function saveName() {
    if (!pending) return;
    setLoading(true);
    try {
      await api('/auth/me', { method: 'PATCH', body: { fullName: name.trim() } });
      await signIn(pending);
    } catch (e) { notifyError(e); } finally { setLoading(false); }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.brandDark }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end' }} keyboardShouldPersistTaps="handled">
          <View style={{ position: 'absolute', right: -80, top: -60, width: 260, height: 260, borderRadius: 130, borderWidth: 32, borderColor: 'rgba(58,169,53,.28)' }} />
          <View style={{ padding: 26, gap: 14, paddingTop: 48 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.brand500, alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 4, borderColor: colors.green }} />
              </View>
              <Text style={{ color: '#fff', fontSize: 20, fontWeight: '800' }}>Smart Tontine</Text>
            </View>
            <Text style={{ color: '#fff', fontSize: 32, fontWeight: '800', letterSpacing: -0.8, lineHeight: 38, marginTop: 10 }}>
              Ta tontine, <Text style={{ color: '#8BE086' }}>sûre</Text> et sans espèces.
            </Text>
            <View style={{ gap: 10, marginTop: 4 }}>
              {PROMISES.map(([I, t]) => (
                <View key={t} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(255,255,255,.12)', alignItems: 'center', justifyContent: 'center' }}><I size={17} color="#fff" /></View>
                  <Text style={{ color: 'rgba(255,255,255,.85)', flex: 1 }}>{t}</Text>
                </View>
              ))}
            </View>
          </View>
          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, gap: 14, paddingBottom: 32 }}>
            {step === 'phone' ? (
              <>
                <Text style={{ fontSize: 20, fontWeight: '800', color: colors.ink }}>Connexion ou inscription</Text>
                <Text style={{ color: colors.ink2 }}>On t’envoie un code par SMS. Pas encore de compte ? Il est créé automatiquement.</Text>
                <Field label="Numéro de téléphone" value={phone} onChangeText={(v) => setPhone(v.replace(/[^\d+ ]/g, ''))} keyboardType="phone-pad" autoComplete="tel" maxLength={18} />
                <Button title="Recevoir mon code" icon={ArrowRight} onPress={requestCode} loading={loading} variant="green" disabled={phone.replace(/\D/g, '').length < 11} />
              </>
            ) : step === 'name' ? (
              <>
                <Text style={{ fontSize: 20, fontWeight: '800', color: colors.ink }}>Comment t’appelles-tu ?</Text>
                <Text style={{ color: colors.ink2 }}>Ton nom s’affiche auprès des membres de tes tontines.</Text>
                <Field label="Prénom et nom" value={name} onChangeText={setName} autoComplete="name" maxLength={80} />
                <Button title="Continuer" icon={ArrowRight} onPress={saveName} loading={loading} variant="green" disabled={name.trim().length < 2} />
              </>
            ) : (
              <>
                <Text style={{ fontSize: 20, fontWeight: '800', color: colors.ink }}>Saisis ton code</Text>
                <Text style={{ color: hint.startsWith('Mode démo') ? colors.gold : colors.ink2, fontWeight: hint.startsWith('Mode démo') ? '700' : '400' }}>{hint}</Text>
                <Field label="Code à 6 chiffres" value={code} onChangeText={(v) => setCode(v.replace(/\D/g, ''))} keyboardType="number-pad" maxLength={6} autoComplete="sms-otp" textContentType="oneTimeCode"
                  style={{ fontSize: 24, letterSpacing: 10, textAlign: 'center', fontWeight: '700' }} />
                <Field label="Ton prénom et nom (nouveau compte)" value={name} onChangeText={setName} />
                <Field label="Code parrain (facultatif)" value={referral} onChangeText={setReferral} autoCapitalize="characters" />
                <Button title="Continuer" onPress={verify} loading={loading} variant="green" disabled={code.length !== 6} />
                <Button title="Changer de numéro" onPress={() => setStep('phone')} variant="ghost" />
              </>
            )}
            <Text style={{ color: colors.muted, fontSize: 12, textAlign: 'center' }}>En continuant, tu acceptes les conditions d’utilisation et la politique de confidentialité.</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
