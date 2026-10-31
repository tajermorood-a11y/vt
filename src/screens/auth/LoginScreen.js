import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Pressable } from 'react-native';
import { Screen, T, Btn, Field } from '../../components/ui';
import { colors } from '../../theme';
import { supabase, arabicError } from '../../lib/supabase';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const login = async () => {
    setError('');
    if (!email.trim() || !pass) return setError('اكتب البريد وكلمة المرور');
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(), password: pass,
    });
    setLoading(false);
    if (err) {
      if (err.message && err.message.includes('Email not confirmed')) {
        return navigation.navigate('Verify', { email: email.trim().toLowerCase(), mode: 'signup' });
      }
      setError(arabicError(err));
    }
  };

  const forgot = async () => {
    setError('');
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('اكتب بريدك الإلكتروني أولاً');
    const e = email.trim().toLowerCase();
    const { error: err } = await supabase.auth.resetPasswordForEmail(e);
    if (err) return setError(arabicError(err));
    navigation.navigate('Verify', { email: e, mode: 'recovery' });
  };

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
          <T size={26} bold style={{ marginBottom: 20 }}>تسجيل الدخول</T>
          <Field
            label="البريد الإلكتروني" value={email} onChangeText={setEmail} autoCapitalize="none"
            keyboardType="email-address" autoCorrect={false}
          />
          <Field label="كلمة المرور" value={pass} onChangeText={setPass} secureTextEntry />
          {error ? <T color={colors.red} style={{ marginBottom: 10 }}>{error}</T> : null}
          <Btn title="دخول" onPress={login} loading={loading} />
          <Pressable onPress={forgot} style={{ padding: 14 }}>
            <T color={colors.green} style={{ textAlign: 'center' }}>نسيت كلمة المرور؟</T>
          </Pressable>
          <Btn title="إنشاء حساب جديد" variant="ghost" onPress={() => navigation.navigate('SignUp')} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
