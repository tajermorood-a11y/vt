import React from 'react';
import {
  ActivityIndicator, Image, Pressable, Text, TextInput, View, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, rtl, row } from '../theme';

export function Screen({ children, style, edges = ['top', 'left', 'right'] }) {
  return (
    <SafeAreaView edges={edges} style={[{ flex: 1, backgroundColor: colors.bg }, style]}>
      {children}
    </SafeAreaView>
  );
}

export function T({ children, style, size = 15, color = colors.text, bold, ...rest }) {
  return (
    <Text
      {...rest}
      style={[rtl, { fontSize: size, color, fontWeight: bold ? '700' : '400' }, style]}
    >
      {children}
    </Text>
  );
}

export function Btn({ title, onPress, loading, disabled, variant = 'primary', style }) {
  const bg = variant === 'primary' ? colors.green : variant === 'danger' ? colors.red : colors.card2;
  const off = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg, opacity: off ? 0.5 : pressed ? 0.85 : 1 },
        variant === 'ghost' && { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <T bold size={16} color={variant === 'ghost' ? colors.text : '#fff'} style={{ textAlign: 'center' }}>
          {title}
        </T>
      )}
    </Pressable>
  );
}

export function Field({ label, error, style, ...props }) {
  return (
    <View style={{ marginBottom: 14 }}>
      {label ? <T size={13} color={colors.muted} style={{ marginBottom: 6 }}>{label}</T> : null}
      <TextInput
        placeholderTextColor={colors.muted}
        {...props}
        style={[styles.input, rtl, error && { borderColor: colors.red }, style]}
      />
      {error ? <T size={12} color={colors.red} style={{ marginTop: 4 }}>{error}</T> : null}
    </View>
  );
}

export function Chip({ title, active, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active && { backgroundColor: colors.green, borderColor: colors.green }]}
    >
      <T size={13} bold={active} color={active ? '#fff' : colors.muted}>{title}</T>
    </Pressable>
  );
}

export function Avatar({ name, uri, size = 40 }) {
  if (uri) {
    return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.card2 }} />;
  }
  const initial = (name || '?').trim().charAt(0).toUpperCase();
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2, backgroundColor: colors.card2,
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ color: colors.green, fontWeight: '700', fontSize: size * 0.42 }}>{initial}</Text>
    </View>
  );
}

export function Empty({ text }) {
  return (
    <View style={{ padding: 40, alignItems: 'center' }}>
      <T color={colors.muted} style={{ textAlign: 'center' }}>{text}</T>
    </View>
  );
}

export function Loading() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
      <ActivityIndicator size="large" color={colors.green} />
    </View>
  );
}

export function Header({ title, right }) {
  return (
    <View style={[row, { justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 }]}>
      <T size={22} bold>{title}</T>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  btn: { height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  input: {
    height: 52, borderRadius: 14, backgroundColor: colors.card, color: colors.text,
    borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, fontSize: 16,
  },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, marginLeft: 8,
  },
});
