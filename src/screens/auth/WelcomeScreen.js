import React from 'react';
import { View } from 'react-native';
import { Screen, T, Btn } from '../../components/ui';
import { colors } from '../../theme';

export default function WelcomeScreen({ navigation }) {
  return (
    <Screen>
      <View style={{ flex: 1, padding: 24, justifyContent: 'center' }}>
        <View style={{ alignItems: 'center', marginBottom: 48 }}>
          <T size={64} bold color={colors.green} style={{ textAlign: 'center', writingDirection: 'ltr' }}>VanTom</T>
          <T color={colors.muted} style={{ textAlign: 'center', marginTop: 8 }}>
            توقّع نتائج المباريات وتنافس مع أصدقائك
          </T>
        </View>
        <Btn title="إنشاء حساب" onPress={() => navigation.navigate('SignUp')} />
        <Btn
          title="تسجيل الدخول"
          variant="ghost"
          style={{ marginTop: 12 }}
          onPress={() => navigation.navigate('Login')}
        />
      </View>
    </Screen>
  );
}
