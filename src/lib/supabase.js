import 'react-native-url-polyfill/auto';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_KEY } from '../config';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Refresh tokens only while the app is in the foreground
AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});

// Arabic messages for server-side error codes / auth errors
const MESSAGES = {
  NOT_AUTHENTICATED: 'سجّل الدخول أولاً',
  OUTCOME_NOT_FOUND: 'الخيار غير موجود',
  OUTCOME_INACTIVE: 'هذا الخيار غير متاح حالياً',
  MARKET_NOT_OPEN: 'السوق مغلق أو معلّق',
  MARKET_CLOSED: 'انتهى وقت التوقع لهذا السوق',
  MATCH_NOT_BETTABLE: 'لا يمكن التوقع على هذه المباراة الآن',
  ODDS_CHANGED: 'تغيّرت الأودز، راجع القيمة الجديدة',
  ALREADY_PREDICTED: 'لديك توقع مسبق في هذا السوق',
  'Invalid login credentials': 'البريد أو كلمة المرور غير صحيحة',
  'Email not confirmed': 'لم يتم تأكيد البريد الإلكتروني بعد',
  'User already registered': 'هذا البريد مسجّل مسبقاً',
  'Token has expired or is invalid': 'الرمز غير صحيح أو منتهي الصلاحية',
};

export function arabicError(error) {
  const msg = (error && (error.message || String(error))) || '';
  for (const key of Object.keys(MESSAGES)) {
    if (msg.includes(key)) return MESSAGES[key];
  }
  if (/network|fetch/i.test(msg)) return 'تعذّر الاتصال بالإنترنت';
  if (/rate limit|too many/i.test(msg)) return 'محاولات كثيرة، حاول لاحقاً';
  return 'حدث خطأ غير متوقع';
}
