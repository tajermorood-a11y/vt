import React from 'react';
import { Image, Pressable, View } from 'react-native';
import { T, Avatar } from './ui';
import { colors, row } from '../theme';

export const MARKET_LABELS = {
  match_result: 'نتيجة المباراة',
  over_under: 'مجموع الأهداف',
  both_teams_to_score: 'تسجيل الفريقين',
  correct_score: 'النتيجة الدقيقة',
};
const ORDER = ['home_win', 'draw', 'away_win', 'yes', 'no'];
const STATUS = {
  scheduled: { t: 'قادمة', c: colors.blue },
  live: { t: 'مباشر', c: colors.red },
  finished: { t: 'انتهت', c: colors.muted },
  postponed: { t: 'مؤجلة', c: colors.amber },
  cancelled: { t: 'ملغاة', c: colors.muted },
};

const pad = (n) => String(n).padStart(2, '0');
export function fmtTime(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}  ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function Team({ team }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      {team?.logo_url ? (
        <Image source={{ uri: team.logo_url }} style={{ width: 44, height: 44 }} resizeMode="contain" />
      ) : (
        <Avatar name={team?.name} size={44} />
      )}
      <T size={13} bold style={{ textAlign: 'center', marginTop: 6 }} numberOfLines={2}>
        {team?.name}
      </T>
    </View>
  );
}

function sortOutcomes(list) {
  return [...list].sort((a, b) => {
    const ia = ORDER.indexOf(a.outcome_code);
    const ib = ORDER.indexOf(b.outcome_code);
    if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    return a.label.localeCompare(b.label);
  });
}

export default function MatchCard({ match, myPredictions, onPick }) {
  const st = STATUS[match.status] || STATUS.scheduled;
  const showScore = match.status === 'live' || match.status === 'finished';
  const matchOpen = match.status === 'scheduled' && new Date(match.start_time) > new Date();

  return (
    <View style={{
      backgroundColor: colors.card, borderRadius: 18, padding: 14, marginHorizontal: 16,
      marginBottom: 14, borderWidth: 1, borderColor: colors.border,
    }}>
      <View style={[row, { justifyContent: 'space-between', marginBottom: 12 }]}>
        <T size={12} color={colors.muted}>{match.competition?.name}</T>
        <View style={[row]}>
          <T size={12} color={colors.muted}>{fmtTime(match.start_time)}</T>
          <View style={{
            backgroundColor: st.c + '33', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, marginRight: 8,
          }}>
            <T size={11} bold color={st.c}>{st.t}</T>
          </View>
        </View>
      </View>

      <View style={[row, { marginBottom: 14 }]}>
        <Team team={match.home} />
        <View style={{ width: 80, alignItems: 'center' }}>
          {showScore ? (
            <T size={26} bold style={{ textAlign: 'center', writingDirection: 'ltr' }}>
              {match.home_score ?? 0} - {match.away_score ?? 0}
            </T>
          ) : (
            <T size={18} color={colors.muted} bold style={{ textAlign: 'center' }}>VS</T>
          )}
        </View>
        <Team team={match.away} />
      </View>

      {(match.markets || []).map((mk) => {
        const mine = myPredictions[mk.id];
        const open = matchOpen && mk.status === 'open' && new Date(mk.closes_at) > new Date();
        return (
          <View key={mk.id} style={{ marginTop: 6 }}>
            <T size={12} color={colors.muted} style={{ marginBottom: 6 }}>
              {MARKET_LABELS[mk.market_type] || mk.market_type}
              {!open && !mine ? '  (مغلق)' : ''}
            </T>
            <View style={[row, { flexWrap: 'wrap' }]}>
              {sortOutcomes(mk.market_outcomes || []).map((o) => {
                const picked = mine && mine.outcome_id === o.id;
                const result = picked ? mine.status : null;
                const bg = picked
                  ? result === 'won' ? colors.green : result === 'lost' ? colors.red : colors.greenDark
                  : colors.card2;
                const disabled = !open || !o.is_active || !!mine;
                return (
                  <Pressable
                    key={o.id}
                    disabled={disabled}
                    onPress={() => onPick({ match, market: mk, outcome: o })}
                    style={({ pressed }) => ({
                      flexGrow: 1, flexBasis: '30%', margin: 3, paddingVertical: 10, borderRadius: 12,
                      backgroundColor: bg, alignItems: 'center',
                      opacity: disabled && !picked ? 0.45 : pressed ? 0.8 : 1,
                      borderWidth: picked ? 2 : 0, borderColor: '#fff3',
                    })}
                  >
                    <T size={11} color={picked ? '#fff' : colors.muted} style={{ textAlign: 'center' }} numberOfLines={1}>
                      {o.label}
                    </T>
                    <T size={17} bold style={{ textAlign: 'center', writingDirection: 'ltr' }}>
                      {Number(o.odds).toFixed(2)}
                    </T>
                  </Pressable>
                );
              })}
            </View>
          </View>
        );
      })}
    </View>
  );
}
