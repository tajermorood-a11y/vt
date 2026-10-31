import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { Screen, Header, Chip, Field, Empty, Loading, T, Avatar, Btn } from '../../components/ui';
import { LeaderRow } from './LeaderboardScreen';
import { supabase, arabicError } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { colors, row } from '../../theme';

export default function FriendsScreen() {
  const { session } = useAuth();
  const uid = session.user.id;
  const [tab, setTab] = useState('ranking');
  const [friends, setFriends] = useState(null);
  const [requests, setRequests] = useState([]);
  const [ranking, setRanking] = useState([]);
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [sent, setSent] = useState({});

  const load = useCallback(async () => {
    const [f, r, l] = await Promise.all([
      supabase.rpc('get_friends'),
      supabase.rpc('get_friend_requests'),
      supabase.rpc('get_friends_leaderboard', { p_limit: 100 }),
    ]);
    setFriends(f.data || []);
    setRequests(r.data || []);
    setRanking(l.data || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const search = async () => {
    if (q.trim().length < 2) return setResults([]);
    const { data, error } = await supabase.rpc('search_users', { p_query: q.trim() });
    if (error) return Alert.alert('خطأ', arabicError(error));
    setResults(data || []);
  };

  const sendRequest = async (id) => {
    const { error } = await supabase.from('friendships').insert({ requester_id: uid, addressee_id: id });
    if (error) {
      if (error.code === '23505') {
        setSent((s) => ({ ...s, [id]: true }));
        return Alert.alert('تنبيه', 'يوجد طلب أو صداقة قائمة مع هذا المستخدم');
      }
      return Alert.alert('خطأ', arabicError(error));
    }
    setSent((s) => ({ ...s, [id]: true }));
  };

  const respond = async (requesterId, status) => {
    const { error } = await supabase.from('friendships').update({ status })
      .eq('requester_id', requesterId).eq('addressee_id', uid);
    if (error) return Alert.alert('خطأ', arabicError(error));
    load();
  };

  const removeFriend = (id, name) => {
    Alert.alert('إزالة صديق', `هل تريد إزالة ${name}؟`, [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'إزالة', style: 'destructive', onPress: async () => {
          await supabase.from('friendships').delete()
            .or(`and(requester_id.eq.${uid},addressee_id.eq.${id}),and(requester_id.eq.${id},addressee_id.eq.${uid})`);
          load();
        },
      },
    ]);
  };

  const TABS = [
    { key: 'ranking', label: 'الترتيب' },
    { key: 'list', label: 'أصدقائي' },
    { key: 'requests', label: `الطلبات${requests.length ? ` (${requests.length})` : ''}` },
    { key: 'search', label: 'بحث' },
  ];

  return (
    <Screen>
      <Header title="الأصدقاء" />
      <View style={{ height: 46 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, flexDirection: 'row-reverse' }}>
          {TABS.map((t) => <Chip key={t.key} title={t.label} active={tab === t.key} onPress={() => setTab(t.key)} />)}
        </ScrollView>
      </View>

      {friends === null ? <Loading /> : (
        <ScrollView contentContainerStyle={{ paddingBottom: 30, paddingTop: 6 }} keyboardShouldPersistTaps="handled">
          {tab === 'ranking' && (
            ranking.length <= 1 && friends.length === 0
              ? <Empty text="أضف أصدقاء لتتنافسوا معاً" />
              : ranking.map((r) => <LeaderRow key={r.user_id} item={r} me={r.user_id === uid} />)
          )}

          {tab === 'list' && (
            friends.length === 0 ? <Empty text="لا يوجد أصدقاء بعد" /> : friends.map((f) => (
              <Pressable key={f.friend_id} onLongPress={() => removeFriend(f.friend_id, f.full_name)}
                style={[row, { backgroundColor: colors.card, borderRadius: 14, padding: 12, marginHorizontal: 16, marginBottom: 8 }]}>
                <Avatar name={f.full_name} uri={f.avatar_url} />
                <T bold style={{ flex: 1, marginHorizontal: 12 }}>{f.full_name}</T>
                <T size={11} color={colors.muted}>اضغط مطولاً للإزالة</T>
              </Pressable>
            ))
          )}

          {tab === 'requests' && (
            requests.length === 0 ? <Empty text="لا توجد طلبات" /> : requests.map((r) => (
              <View key={r.requester_id}
                style={{ backgroundColor: colors.card, borderRadius: 14, padding: 12, marginHorizontal: 16, marginBottom: 8 }}>
                <View style={[row, { marginBottom: 10 }]}>
                  <Avatar name={r.full_name} uri={r.avatar_url} />
                  <T bold style={{ flex: 1, marginHorizontal: 12 }}>{r.full_name}</T>
                </View>
                <View style={[row]}>
                  <Btn title="قبول" style={{ flex: 1, height: 42, marginLeft: 8 }} onPress={() => respond(r.requester_id, 'accepted')} />
                  <Btn title="رفض" variant="ghost" style={{ flex: 1, height: 42 }} onPress={() => respond(r.requester_id, 'rejected')} />
                </View>
              </View>
            ))
          )}

          {tab === 'search' && (
            <View style={{ paddingHorizontal: 16 }}>
              <Field placeholder="ابحث بالاسم (حرفان على الأقل)" value={q} onChangeText={setQ}
                onSubmitEditing={search} returnKeyType="search" />
              <Btn title="بحث" onPress={search} style={{ marginBottom: 14 }} />
              {results.map((u) => (
                <View key={u.id} style={[row, { backgroundColor: colors.card, borderRadius: 14, padding: 12, marginBottom: 8 }]}>
                  <Avatar name={u.full_name} uri={u.avatar_url} />
                  <T bold style={{ flex: 1, marginHorizontal: 12 }}>{u.full_name}</T>
                  <Btn title={sent[u.id] ? 'تم الإرسال' : 'إضافة'} disabled={!!sent[u.id]}
                    style={{ height: 38, paddingHorizontal: 14 }} onPress={() => sendRequest(u.id)} />
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </Screen>
  );
}
