# Xwin (Expo + Supabase)

## تشغيل للتجربة
```
npm install
npx expo start
```
افتح التطبيق على هاتفك عبر Expo Go (SDK 54).

## بناء APK للأندرويد (EAS)
```
npm install -g eas-cli
eas login
eas build:configure        # مرة واحدة، يربط المشروع بحسابك
eas build -p android --profile preview
```
ينتهي البناء برابط تنزيل APK. للنشر على المتجر: `--profile production`.

## الاتصال بـ Supabase
الإعدادات في `src/config.js` (Project URL + publishable key فقط).
لا تضع مفتاح service_role في التطبيق أبداً.

## مهم: رمز التحقق بالبريد
في Supabase: Authentication → Emails → Templates، عدّل قالبي **Confirm signup**
و**Reset password** ليحتويا على `{{ .Token }}` (الرمز المكوّن من أرقام) بدل الرابط فقط، مثال:

    رمز التحقق الخاص بك: {{ .Token }}

بدون ذلك سيصل رابط وليس رمز، ولن تعمل شاشة إدخال الرمز.
(للتجربة السريعة يمكن إيقاف Confirm email من Authentication → Providers → Email.)

## جعل حسابك مديراً
بعد التسجيل، في SQL Editor:
```
insert into public.admin_users (user_id) values ('<معرّفك من Authentication → Users>');
```

## إضافة مباراة للتجربة
أضف صفوفاً في الجداول: competitions ثم teams ثم matches ثم markets ثم market_outcomes
(من Table Editor). تظهر المباراة في التطبيق فوراً، وتتحدث الأودز مباشرة عند تعديلها.
