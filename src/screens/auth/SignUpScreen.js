import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen, T, Btn, Field } from '../../components/ui';
import { colors, row } from '../../theme';
import { supabase, arabicError } from '../../lib/supabase';
import { MIN_AGE } from '../../config';

function parseDob(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  if (d.getUTCFullYear() !== +m[1] || d.getUTCMonth() !== +m[2] - 1 || d.getUTCDate() !== +m[3]) return null;
  return d;
}
function ageOf(d) {
  const now = new Date();
  let age = now.getUTCFullYear() - d.getUTCFullYear();
  const beforeBirthday =
    now.getUTCMonth() < d.getUTCMonth() ||
    (now.getUTCMonth() === d.getUTCMonth() && now.getUTCDate() < d.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

export default function SignUpScreen({ navigation }) {
  const [f, setF] = useState({ name: '', dob: '', email: '', pass: '', pass2: '' });
  const [agree, setAgree] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const set = (k) => (v) => setF((p) => ({ ...p, [k]: v }));

  const submit = async () => {
    const e = {};
    if (f.name.trim().length < 2) e.name = 'اكتب الاسم الكامل';
    const dob = parseDob(f.dob);
    if (!dob) e.dob = 'الصيغة: YYYY-MM-DD (مثال 2000-01-31)';
    else if (ageOf(dob) < MIN_AGE) e.dob = `يجب أن يكون عمرك ${MIN_AGE} سنة أو أكثر`;
    if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) e.email = 'بريد إلكتروني غير صالح';
    if (f.pass.length < 8) e.pass = 'كلمة المرور 8 أحرف على الأقل';
    if (f.pass2 !== f.pass) e.pass2 = 'كلمتا المرور غير متطابقتين';
    if (!agree) e.agree = 'يجب الموافقة على الشروط وسياسة الخصوصية';
    setErrors(e);
    if (Object.keys(e).length) return;

    setLoading(true);
    const email = f.email.trim().toLowerCase();
    const { data, error } = await supabase.auth.signUp({
      email,
      password: f.pass,
      options: { data: { full_name: f.name.trim(), date_of_birth: f.dob.trim() } },
    });
    setLoading(false);
    if (error) return setErrors({ form: arabicError(error) });
    // If email confirmation is disabled, a session is returned and the app switches automatically.
    if (!data.session) navigation.navigate('Verify', { email, mode: 'signup' });
  };

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
          <T size={26} bold style={{ marginBottom: 20 }}>إنشاء حساب</T>
          <Field label="الاسم الكامل" value={f.name} onChangeText={set('name')} error={errors.name} />
          <Field
            label="تاريخ الميلاد" placeholder="2000-01-31" value={f.dob} onChangeText={set('dob')}
            keyboardType="numbers-and-punctuation" error={errors.dob} maxLength={10}
          />
          <Field
            label="البريد الإلكتروني" value={f.email} onChangeText={set('email')} autoCapitalize="none"
            keyboardType="email-address" autoCorrect={false} error={errors.email}
          />
          <Field label="كلمة المرور" value={f.pass} onChangeText={set('pass')} secureTextEntry error={errors.pass} />
          <Field label="إعادة كتابة كلمة المرور" value={f.pass2} onChangeText={set('pass2')} secureTextEntry error={errors.pass2} />

          <Pressable onPress={() => setAgree(!agree)} style={[row, { marginBottom: 6 }]}>
            <Ionicons
              name={agree ? 'checkbox' : 'square-outline'} size={24}
              color={agree ? colors.green : colors.muted}
            />
            <T size={13} color={colors.muted} style={{ marginRight: 8, flex: 1 }}>
              أوافق على شروط الاستخدام وسياسة الخصوصية
            </T>
          </Pressable>
          {errors.agree ? <T size={12} color={colors.red}>{errors.agree}</T> : null}
          {errors.form ? <T color={colors.red} style={{ marginTop: 8 }}>{errors.form}</T> : null}

          <View style={{ height: 16 }} />
          <Btn title="إنشاء الحساب" onPress={submit} loading={loading} />
          <Btn title="لديّ حساب" variant="ghost" style={{ marginTop: 12 }} onPress={() => navigation.navigate('Login')} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
