import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  MatchFinishedPayload,
  MatchRankingEntry,
  RoomState
} from '@climb/shared';
import { saveLocalRecord } from '../db/scoreService';
import { HapticsService } from '../haptics/hapticsService';

export interface ResultsScreenProps {
  roomState: RoomState;
  matchResult: MatchFinishedPayload | null;
  playerId: string;
  onRematch: () => void;
  onLeaveRoom: () => void;
}

// Session-level deduplication set complementing component ref so React 19 StrictMode
// or transient re-renders never insert duplicate rows into SQLite `local_records`.
const persistedMatchKeys = new Set<string>();

function getOrdinalLabel(rank: number): string {
  switch (rank) {
    case 1:
      return '1ST';
    case 2:
      return '2ND';
    case 3:
      return '3RD';
    default:
      return `${rank}TH`;
  }
}

export const ResultsScreen: React.FC<ResultsScreenProps> = ({
  roomState,
  matchResult,
  playerId,
  onRematch,
  onLeaveRoom
}) => {
  const savedMatchKeyRef = useRef<string | null>(null);
  const [savedToSqlite, setSavedToSqlite] = useState<boolean>(false);

  const rankings: MatchRankingEntry[] = useMemo(() => {
    if (matchResult && matchResult.rankings.length > 0) {
      return matchResult.rankings;
    }

    const sorted = [...roomState.players].sort((a, b) => {
      if (a.finishTimeMs !== null && b.finishTimeMs !== null) {
        return a.finishTimeMs - b.finishTimeMs;
      }
      if (a.finishTimeMs !== null) return -1;
      if (b.finishTimeMs !== null) return 1;
      return b.height - a.height;
    });

    return sorted.map((p, index) => ({
      rank: index + 1,
      playerId: p.id,
      nickname: p.nickname,
      color: p.color,
      height: p.height,
      score: p.score,
      status: p.status,
      finishTimeMs: p.finishTimeMs
    }));
  }, [matchResult, roomState.players]);

  const activeSeed = matchResult?.seed ?? roomState.seed;
  const finishStamp = roomState.finishedAt ?? matchResult?.durationMs ?? 0;
  const matchUniqueKey = `${playerId}:${roomState.code}:${activeSeed}:${
    roomState.startedAt ?? finishStamp
  }`;

  // Auto-save local player's finished run to SQLite `local_records` strictly once per match
  useEffect(() => {
    if (!activeSeed) return;
    if (
      savedMatchKeyRef.current === matchUniqueKey ||
      persistedMatchKeys.has(matchUniqueKey)
    ) {
      setSavedToSqlite(true);
      return;
    }

    const selfEntry = rankings.find((r) => r.playerId === playerId);
    if (!selfEntry) return;

    savedMatchKeyRef.current = matchUniqueKey;
    persistedMatchKeys.add(matchUniqueKey);

    const runDurationMs =
      selfEntry.finishTimeMs ??
      matchResult?.durationMs ??
      (roomState.startedAt && roomState.finishedAt
        ? Math.max(0, roomState.finishedAt - roomState.startedAt)
        : 0);

    void saveLocalRecord({
      playerId,
      score: Math.max(selfEntry.score, Math.round(selfEntry.height * 10)),
      height: selfEntry.height,
      seed: activeSeed,
      durationMs: runDurationMs
    })
      .then(() => {
        setSavedToSqlite(true);
      })
      .catch((err) => {
        console.warn('Failed to persist match record in SQLite:', err);
      });
  }, [
    activeSeed,
    matchUniqueKey,
    matchResult,
    playerId,
    rankings,
    roomState.finishedAt,
    roomState.startedAt
  ]);

  const winner = rankings[0];
  const isSelfWinner = winner?.playerId === playerId;

  return (
    <View style={styles.card}>
      <View style={styles.banner}>
        <Text style={styles.kicker}>
          FINAL STANDINGS • ROOM {roomState.code}
        </Text>
        <Text style={styles.headline}>
          {isSelfWinner
            ? '🏆 SUMMIT CHAMPION!'
            : winner
            ? `🏆 ${winner.nickname} Reached the Summit!`
            : 'Match Complete'}
        </Text>
        <View style={styles.metaBadgeRow}>
          <Text style={styles.seedPill}>
            Seed 0x{activeSeed.toString(16).toUpperCase()}
          </Text>
          {savedToSqlite && (
            <Text style={styles.savedPill}>✓ Saved to SQLite</Text>
          )}
        </View>
      </View>

      {/* Ranked Podium (1st - 4th) */}
      <View style={styles.podiumList}>
        {rankings.map((entry) => {
          const isSelf = entry.playerId === playerId;
          const finished = entry.finishTimeMs !== null;
          const resultPrimary = finished
            ? `${(entry.finishTimeMs! / 1000).toFixed(2)}s`
            : `${Math.round(entry.height)}m`;
          const resultCaption = finished ? 'FINISH TIME' : 'MAX HEIGHT';

          return (
            <View
              key={entry.playerId}
              style={[styles.rankRow, isSelf && styles.rankRowSelf]}
            >
              <View
                style={[
                  styles.rankBadge,
                  entry.rank === 1 && styles.rankGold,
                  entry.rank === 2 && styles.rankSilver,
                  entry.rank === 3 && styles.rankBronze
                ]}
              >
                <Text
                  style={[
                    styles.rankNumber,
                    entry.rank <= 3 && styles.rankDarkText
                  ]}
                >
                  {getOrdinalLabel(entry.rank)}
                </Text>
              </View>

              <View
                style={[styles.colorDot, { backgroundColor: entry.color }]}
              />

              <View style={styles.playerCol}>
                <View style={styles.playerNameRow}>
                  <Text style={styles.playerName} numberOfLines={1}>
                    {entry.nickname}
                  </Text>
                  {isSelf && <Text style={styles.youBadge}>YOU</Text>}
                </View>
                <Text style={styles.playerStats}>
                  {Math.max(entry.score, Math.round(entry.height * 10))} pts •{' '}
                  {Math.round(entry.height)}m / {roomState.targetHeight}m
                </Text>
              </View>

              <View style={styles.resultCol}>
                <Text
                  style={[
                    styles.timeValue,
                    finished && styles.timeValueFinished
                  ]}
                >
                  {resultPrimary}
                </Text>
                <Text style={styles.resultCaption}>{resultCaption}</Text>
              </View>
            </View>
          );
        })}
      </View>

      <View style={styles.actions}>
        <Pressable
          style={({ pressed }) => [
            styles.rematchBtn,
            pressed && styles.rematchBtnPressed
          ]}
          onPress={() => {
            void HapticsService.selection();
            onRematch();
          }}
        >
          <Text style={styles.rematchText}>Play Again (Rematch)</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.leaveBtn,
            pressed && styles.leaveBtnPressed
          ]}
          onPress={() => {
            void HapticsService.selection();
            onLeaveRoom();
          }}
        >
          <Text style={styles.leaveText}>Back to Lobby</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#334155'
  },
  banner: {
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#334155'
  },
  kicker: {
    color: '#FBBF24',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2
  },
  headline: {
    color: '#F8FAFC',
    fontSize: 21,
    fontWeight: '900',
    textAlign: 'center',
    marginVertical: 8
  },
  metaBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2
  },
  seedPill: {
    backgroundColor: '#0F172A',
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'monospace',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155'
  },
  savedPill: {
    backgroundColor: '#064E3B',
    color: '#34D399',
    fontSize: 11,
    fontWeight: '800',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6
  },
  podiumList: {
    gap: 10,
    marginBottom: 22
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#1E293B'
  },
  rankRowSelf: {
    borderColor: '#38BDF8',
    backgroundColor: '#0F1F38'
  },
  rankBadge: {
    minWidth: 44,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    paddingHorizontal: 6
  },
  rankGold: {
    backgroundColor: '#FACC15'
  },
  rankSilver: {
    backgroundColor: '#CBD5E1'
  },
  rankBronze: {
    backgroundColor: '#FB923C'
  },
  rankNumber: {
    color: '#F8FAFC',
    fontWeight: '900',
    fontSize: 12
  },
  rankDarkText: {
    color: '#0F172A'
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 10
  },
  playerCol: {
    flex: 1,
    marginRight: 8
  },
  playerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  playerName: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '800',
    flexShrink: 1
  },
  youBadge: {
    backgroundColor: '#0284C7',
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  playerStats: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 2,
    fontWeight: '600'
  },
  resultCol: {
    alignItems: 'flex-end'
  },
  timeValue: {
    color: '#CBD5E1',
    fontSize: 15,
    fontWeight: '900',
    fontFamily: 'monospace'
  },
  timeValueFinished: {
    color: '#4ADE80'
  },
  resultCaption: {
    color: '#64748B',
    fontSize: 9,
    fontWeight: '800',
    marginTop: 2
  },
  actions: {
    gap: 10
  },
  rematchBtn: {
    backgroundColor: '#10B981',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center'
  },
  rematchBtnPressed: {
    backgroundColor: '#059669'
  },
  rematchText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800'
  },
  leaveBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EF4444',
    alignItems: 'center'
  },
  leaveBtnPressed: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)'
  },
  leaveText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '800'
  }
});
