import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { Screen, Header, Chip, Empty, Loading, T, Avatar } from '../../components/ui';
import { supabase, arabicError } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { colors, row } from '../../theme';

const PERIODS = [
  { key: 'day', label: 'اليوم' },
  { key: 'week', label: 'الأسبوع' },
  { key: 'all', label: 'الإجمالي' },
];

export function LeaderRow({ item, me }) {
  const medal = item.rank === 1 ? '🥇' : item.rank === 2 ? '🥈' : item.rank === 3 ? '🥉' : null;
  const acc = item.total_predictions > 0
    ? Math.round((Number(item.correct_predictions) / Number(item.total_predictions)) * 100) : 0;
  return (
    <View style={[row, {
      backgroundColor: me ? colors.green + '22' : colors.card, borderRadius: 14, padding: 12,
      marginHorizontal: 16, marginBottom: 8, borderWidth: 1, borderColor: me ? colors.green : colors.border,
    }]}>
      <View style={{ width: 36, alignItems: 'center' }}>
        {medal ? <T size={22}>{medal}</T> : <T bold color={colors.muted}>{item.rank}</T>}
      </View>
      <Avatar name={item.full_name} uri={item.avatar_url} size={40} />
      <View style={{ flex: 1, marginHorizontal: 10 }}>
        <T bold numberOfLines={1}>{item.full_name}{me ? ' (أنت)' : ''}</T>
        <T size={12} color={colors.muted}>
          صحيحة {item.correct_predictions} من {item.total_predictions} · {acc}%
        </T>
      </View>
      <T size={18} bold color={colors.green} style={{ writingDirection: 'ltr' }}>{String(item.points)}</T>
    </View>
  );
}

export default function LeaderboardScreen() {
  const { session } = useAuth();
  const [period, setPeriod] = useState('all');
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const { data, error: err } = await supabase.rpc('get_leaderboard', { p_period: period, p_limit: 100 });
    if (err) return setError(arabicError(err));
    setError(''); setRows(data);
  }, [period]);

  useEffect(() => { setRows(null); load(); }, [load]);

  return (
    <Screen>
      <Header title="المتصدرون" />
      <View style={[row, { paddingHorizontal: 16, marginBottom: 10 }]}>
        {PERIODS.map((p) => (
          <Chip key={p.key} title={p.label} active={period === p.key} onPress={() => setPeriod(p.key)} />
        ))}
      </View>
      {error ? <T color={colors.red} style={{ padding: 16 }}>{error}</T> : null}
      {rows === null && !error ? (
        <Loading />
      ) : (
        <FlatList
          data={rows || []}
          keyExtractor={(r) => r.user_id}
          renderItem={({ item }) => <LeaderRow item={item} me={item.user_id === session.user.id} />}
          ListEmptyComponent={<Empty text="لا توجد نتائج بعد. يظهر الترتيب بعد تسوية المباريات." />}
          contentContainerStyle={{ paddingBottom: 24 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} tintColor={colors.green}
              onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />
          }
        />
      )}
    </Screen>
  );
}
