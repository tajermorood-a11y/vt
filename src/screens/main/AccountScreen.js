import React, { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, RefreshControl, View } from 'react-native';
import { Screen, Header, Btn, T, Avatar, Empty, Loading } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { colors, row } from '../../theme';

const STATUS = {
  pending: { t: 'قيد الانتظار', c: colors.amber },
  won: { t: 'صحيح', c: colors.green },
  lost: { t: 'خاطئ', c: colors.red },
  void: { t: 'ملغى', c: colors.muted },
};

function Stat({ label, value }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <T size={20} bold style={{ textAlign: 'center', writingDirection: 'ltr' }}>{value}</T>
      <T size={11} color={colors.muted} style={{ textAlign: 'center' }}>{label}</T>
    </View>
  );
}

export default function AccountScreen() {
  const { session, signOut } = useAuth();
  const uid = session.user.id;
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState(null);
  const [history, setHistory] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [p, s, h] = await Promise.all([
      supabase.from('profiles').select('full_name, avatar_url').eq('id', uid).single(),
      supabase.from('user_stats').select('*').eq('user_id', uid).single(),
      supabase.from('predictions')
        .select(`id, status, odds_snapshot, points_awarded, created_at,
          match:matches(home:teams!home_team_id(name), away:teams!away_team_id(name)),
          outcome:market_outcomes(label)`)
        .eq('user_id', uid).order('created_at', { ascending: false }).limit(100),
    ]);
    setProfile(p.data || {});
    setStats(s.data || {});
    setHistory(h.data || []);
  }, [uid]);

  useEffect(() => { load(); }, [load]);

  const confirmLogout = () =>
    Alert.alert('تسجيل الخروج', 'هل تريد تسجيل الخروج؟', [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'خروج', style: 'destructive', onPress: signOut },
    ]);

  if (!profile || !stats) return <Loading />;

  const settled = history.filter((x) => x.status === 'won' || x.status === 'lost').length;
  const correct = stats.correct_predictions || 0;
  const acc = settled > 0 ? Math.round((correct / settled) * 100) : 0;

  const header = (
    <View>
      <View style={{ alignItems: 'center', paddingVertical: 16 }}>
        <Avatar name={profile.full_name} uri={profile.avatar_url} size={80} />
        <T size={20} bold style={{ textAlign: 'center', marginTop: 10 }}>{profile.full_name}</T>
        <T size={12} color={colors.muted} style={{ textAlign: 'center' }}>{session.user.email}</T>
      </View>
      <View style={[row, {
        backgroundColor: colors.card, borderRadius: 16, marginHorizontal: 16, paddingVertical: 16, marginBottom: 16,
      }]}>
        <Stat label="النقاط" value={stats.total_points ?? 0} />
        <Stat label="التوقعات" value={stats.total_predictions ?? 0} />
        <Stat label="الصحيحة" value={correct} />
        <Stat label="النسبة" value={`${acc}%`} />
      </View>
      <T bold size={16} style={{ marginHorizontal: 16, marginBottom: 8 }}>سجل التوقعات</T>
    </View>
  );

  return (
    <Screen>
      <Header title="حسابي" right={<Btn title="خروج" variant="ghost" onPress={confirmLogout} style={{ height: 36, paddingHorizontal: 14 }} />} />
      <FlatList
        data={history}
        keyExtractor={(x) => x.id}
        ListHeaderComponent={header}
        ListEmptyComponent={<Empty text="لم تسجّل أي توقع بعد" />}
        contentContainerStyle={{ paddingBottom: 30 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} tintColor={colors.green}
            onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />
        }
        renderItem={({ item }) => {
          const st = STATUS[item.status] || STATUS.pending;
          return (
            <View style={[row, {
              backgroundColor: colors.card, borderRadius: 14, padding: 12, marginHorizontal: 16, marginBottom: 8,
            }]}>
              <View style={{ flex: 1 }}>
                <T bold numberOfLines={1}>{item.match?.home?.name} - {item.match?.away?.name}</T>
                <T size={12} color={colors.muted}>
                  {item.outcome?.label} · أودز {Number(item.odds_snapshot).toFixed(2)}
                </T>
              </View>
              <View style={{ alignItems: 'center' }}>
                <T size={12} bold color={st.c} style={{ textAlign: 'center' }}>{st.t}</T>
                {item.status === 'won' && (
                  <T size={12} color={colors.green} style={{ textAlign: 'center', writingDirection: 'ltr' }}>+{item.points_awarded}</T>
                )}
              </View>
            </View>
          );
        }}
      />
    </Screen>
  );
}
