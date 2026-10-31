import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, FlatList, RefreshControl, ScrollView, View } from 'react-native';
import { Screen, Header, Chip, Empty, Loading, T } from '../../components/ui';
import MatchCard, { MARKET_LABELS } from '../../components/MatchCard';
import { supabase, arabicError } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme';

const FILTERS = [
  { key: 'all', label: 'الكل' },
  { key: 'scheduled', label: 'القادمة' },
  { key: 'live', label: 'المباشرة' },
  { key: 'finished', label: 'المنتهية' },
];

const SELECT = `
  id, start_time, status, home_score, away_score,
  competition:competitions(id, name),
  home:teams!home_team_id(name, logo_url),
  away:teams!away_team_id(name, logo_url),
  markets(id, market_type, status, closes_at,
    market_outcomes(id, outcome_code, label, odds, is_active))
`;

export default function MatchesScreen() {
  const { session } = useAuth();
  const uid = session.user.id;
  const [filter, setFilter] = useState('all');
  const [competition, setCompetition] = useState('all');
  const [matches, setMatches] = useState(null);
  const [mine, setMine] = useState({});
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const timer = useRef(null);

  const load = useCallback(async () => {
    let q = supabase.from('matches').select(SELECT);
    if (filter !== 'all') q = q.eq('status', filter);
    q = q.order('start_time', { ascending: filter !== 'finished' }).limit(100);

    const [m, p] = await Promise.all([
      q,
      supabase.from('predictions').select('market_id, outcome_id, status, odds_snapshot').eq('user_id', uid),
    ]);
    if (m.error) { setError(arabicError(m.error)); return; }
    setError('');
    setMatches(m.data);
    const map = {};
    (p.data || []).forEach((x) => { map[x.market_id] = x; });
    setMine(map);
  }, [filter, uid]);

  useEffect(() => { setMatches(null); load(); }, [load]);

  // Live updates: odds, market status and scores
  useEffect(() => {
    const refetch = () => {
      clearTimeout(timer.current);
      timer.current = setTimeout(load, 400);
    };
    const ch = supabase
      .channel('xwin-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'market_outcomes' }, refetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'markets' }, refetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, refetch)
      .subscribe();
    return () => { clearTimeout(timer.current); supabase.removeChannel(ch); };
  }, [load]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const place = async ({ match, market, outcome }, expected) => {
    const { error: err } = await supabase.rpc('place_prediction', {
      p_outcome_id: outcome.id, p_expected_odds: expected,
    });
    if (err) {
      if (err.message.includes('ODDS_CHANGED')) {
        await load();
        const newOdds = err.details ? Number(err.details).toFixed(2) : null;
        return Alert.alert(
          'تغيّرت الأودز',
          newOdds ? `القيمة الجديدة ${newOdds}. هل تريد المتابعة؟` : 'راجع القيمة الجديدة ثم أعد المحاولة.',
          newOdds ? [
            { text: 'إلغاء', style: 'cancel' },
            { text: 'تأكيد', onPress: () => place({ match, market, outcome }, Number(err.details)) },
          ] : [{ text: 'حسناً' }],
        );
      }
      if (err.message.includes('ALREADY_PREDICTED')) await load();
      return Alert.alert('تعذّر تسجيل التوقع', arabicError(err));
    }
    await load();
  };

  const onPick = (sel) => {
    const { match, market, outcome } = sel;
    Alert.alert(
      'تأكيد التوقع',
      `${match.home?.name} - ${match.away?.name}\n${MARKET_LABELS[market.market_type] || ''}: ${outcome.label}\nالأودز: ${Number(outcome.odds).toFixed(2)}\n\nلا يمكن تغيير التوقع بعد التأكيد.`,
      [
        { text: 'إلغاء', style: 'cancel' },
        { text: 'تأكيد', onPress: () => place(sel, Number(outcome.odds)) },
      ],
    );
  };

  const competitions = matches
    ? [...new Map(matches.filter((m) => m.competition).map((m) => [m.competition.id, m.competition])).values()]
    : [];
  const shown = (matches || []).filter((m) => competition === 'all' || m.competition?.id === competition);

  return (
    <Screen>
      <Header title="المباريات" />
      <View style={{ height: 46 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, flexDirection: 'row-reverse' }}>
          {FILTERS.map((f) => (
            <Chip key={f.key} title={f.label} active={filter === f.key} onPress={() => setFilter(f.key)} />
          ))}
        </ScrollView>
      </View>
      {competitions.length > 1 && (
        <View style={{ height: 46 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, flexDirection: 'row-reverse' }}>
            <Chip title="كل البطولات" active={competition === 'all'} onPress={() => setCompetition('all')} />
            {competitions.map((c) => (
              <Chip key={c.id} title={c.name} active={competition === c.id} onPress={() => setCompetition(c.id)} />
            ))}
          </ScrollView>
        </View>
      )}
      {error ? <T color={colors.red} style={{ padding: 16 }}>{error}</T> : null}
      {matches === null && !error ? (
        <Loading />
      ) : (
        <FlatList
          data={shown}
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => <MatchCard match={item} myPredictions={mine} onPick={onPick} />}
          ListEmptyComponent={<Empty text="لا توجد مباريات حالياً" />}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 24 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.green} />}
        />
      )}
    </Screen>
  );
}
