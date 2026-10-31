import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Screen, T, Btn, Field } from '../../components/ui';
import { colors } from '../../theme';
import { supabase, arabicError } from '../../lib/supabase';

const COOLDOWN = 60;

// mode = 'signup'   -> confirm email with the 6-digit code
// mode = 'recovery' -> code + new password
export default function VerifyScreen({ route, navigation }) {
  const { email, mode } = route.params;
  const [code, setCode] = useState('');
  const [newPass, setNewPass] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [wait, setWait] = useState(COOLDOWN);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait(wait - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const verify = async () => {
    setError(''); setInfo('');
    if (code.trim().length < 6) return setError('اكتب الرمز المرسل إلى بريدك');
    if (mode === 'recovery' && newPass.length < 8) return setError('كلمة المرور الجديدة 8 أحرف على الأقل');
    setLoading(true);
    const { error: err } = await supabase.auth.verifyOtp({
      email, token: code.trim(), type: mode === 'recovery' ? 'recovery' : 'signup',
    });
    if (err) { setLoading(false); return setError(arabicError(err)); }
    if (mode === 'recovery') {
      const { error: e2 } = await supabase.auth.updateUser({ password: newPass });
      setLoading(false);
      if (e2) return setError(arabicError(e2));
    } else {
      setLoading(false);
    }
    // a session now exists -> the app navigates to the main screen automatically
  };

  const resend = async () => {
    setError(''); setInfo('');
    const { error: err } = mode === 'recovery'
      ? await supabase.auth.resetPasswordForEmail(email)
      : await supabase.auth.resend({ type: 'signup', email });
    if (err) return setError(arabicError(err));
    setInfo('تم إرسال رمز جديد');
    setWait(COOLDOWN);
  };

  return (
    <Screen>
      <View style={{ padding: 20 }}>
        <T size={24} bold style={{ marginBottom: 8 }}>
          {mode === 'recovery' ? 'استعادة كلمة المرور' : 'تأكيد البريد الإلكتروني'}
        </T>
        <T color={colors.muted} style={{ marginBottom: 20 }}>
          أرسلنا رمزاً إلى {email}
        </T>
        <Field
          label="رمز التحقق" value={code} onChangeText={setCode}
          keyboardType="number-pad" maxLength={8} style={{ textAlign: 'center', letterSpacing: 6, fontSize: 22 }}
        />
        {mode === 'recovery' && (
          <Field label="كلمة المرور الجديدة" value={newPass} onChangeText={setNewPass} secureTextEntry />
        )}
        {error ? <T color={colors.red} style={{ marginBottom: 10 }}>{error}</T> : null}
        {info ? <T color={colors.green} style={{ marginBottom: 10 }}>{info}</T> : null}
        <Btn title={mode === 'recovery' ? 'تغيير كلمة المرور' : 'تأكيد'} onPress={verify} loading={loading} />
        <Btn
          title={wait > 0 ? `إعادة الإرسال بعد ${wait} ث` : 'إعادة إرسال الرمز'}
          variant="ghost" disabled={wait > 0} onPress={resend} style={{ marginTop: 12 }}
        />
        <Btn title="رجوع" variant="ghost" onPress={() => navigation.goBack()} style={{ marginTop: 12 }} />
      </View>
    </Screen>
  );
}
