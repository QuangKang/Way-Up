import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  MatchFinishedPayload,
  MatchRankingEntry,
  RoomState
} from '@climb/shared';
import { saveLocalRecord } from '../db/scoreService';

export interface ResultsScreenProps {
  roomState: RoomState;
  matchResult: MatchFinishedPayload | null;
  playerId: string;
  onRematch: () => void;
  onLeaveRoom: () => void;
}

export const ResultsScreen: React.FC<ResultsScreenProps> = ({
  roomState,
  matchResult,
  playerId,
  onRematch,
  onLeaveRoom
}) => {
  const savedResultSeedRef = useRef<number | null>(null);

  const rankings: MatchRankingEntry[] =
    matchResult?.rankings ??
    roomState.players.map((p, index) => ({
      rank: index + 1,
      playerId: p.id,
      nickname: p.nickname,
      color: p.color,
      height: p.height,
      score: p.score,
      status: p.status,
      finishTimeMs: p.finishTimeMs
    }));

  // Persist local player's match score into SQLite `local_records` once per match
  useEffect(() => {
    if (!matchResult) return;
    if (savedResultSeedRef.current === matchResult.seed) return;

    const selfEntry = matchResult.rankings.find((r) => r.playerId === playerId);
    if (!selfEntry) return;

    savedResultSeedRef.current = matchResult.seed;
    void saveLocalRecord({
      playerId,
      score: selfEntry.score,
      height: selfEntry.height,
      seed: matchResult.seed,
      durationMs: selfEntry.finishTimeMs ?? matchResult.durationMs
    }).catch((err) => {
      console.warn('Failed to persist match record in SQLite:', err);
    });
  }, [matchResult, playerId]);

  const winner = rankings[0];
  const isSelfWinner = winner?.playerId === playerId;

  return (
    <View style={styles.card}>
      <View style={styles.banner}>
        <Text style={styles.kicker}>MATCH COMPLETE • ROOM {roomState.code}</Text>
        <Text style={styles.headline}>
          {isSelfWinner
            ? '🏆 VICTORY! YOU REACHED THE SUMMIT!'
            : winner
            ? `🏆 ${winner.nickname} Wins!`
            : 'Match Finished'}
        </Text>
        <Text style={styles.subText}>
          Saved to SQLite local_records • Seed 0x
          {(matchResult?.seed ?? roomState.seed).toString(16).toUpperCase()}
        </Text>
      </View>

      <View style={styles.podiumList}>
        {rankings.map((entry) => {
          const isSelf = entry.playerId === playerId;
          const timeText =
            entry.finishTimeMs !== null
              ? `${(entry.finishTimeMs / 1000).toFixed(2)}s`
              : `${Math.round(entry.height)}m`;

          return (
            <View
              key={entry.playerId}
              style={[styles.rankRow, isSelf && styles.rankRowSelf]}
            >
              <View
                style={[
                  styles.rankBadge,
                  entry.rank === 1 && styles.rankFirstBadge
                ]}
              >
                <Text
                  style={[
                    styles.rankNumber,
                    entry.rank === 1 && styles.rankFirstText
                  ]}
                >
                  #{entry.rank}
                </Text>
              </View>

              <View
                style={[styles.colorDot, { backgroundColor: entry.color }]}
              />

              <View style={styles.playerCol}>
                <Text style={styles.playerName}>
                  {entry.nickname} {isSelf ? '(You)' : ''}
                </Text>
                <Text style={styles.playerStats}>
                  {entry.score} pts • Peak {Math.round(entry.height)}m
                </Text>
              </View>

              <Text style={styles.timeValue}>{timeText}</Text>
            </View>
          );
        })}
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.rematchBtn} onPress={onRematch}>
          <Text style={styles.rematchText}>Play Again (Back to Waiting Room)</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.leaveBtn} onPress={onLeaveRoom}>
          <Text style={styles.leaveText}>Leave Room</Text>
        </TouchableOpacity>
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
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
    marginVertical: 6
  },
  subText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600'
  },
  podiumList: {
    gap: 10,
    marginBottom: 20
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E293B'
  },
  rankRowSelf: {
    borderColor: '#38BDF8'
  },
  rankBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10
  },
  rankFirstBadge: {
    backgroundColor: '#FACC15'
  },
  rankNumber: {
    color: '#F8FAFC',
    fontWeight: '900',
    fontSize: 13
  },
  rankFirstText: {
    color: '#0F172A'
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 10
  },
  playerCol: {
    flex: 1
  },
  playerName: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '700'
  },
  playerStats: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 2
  },
  timeValue: {
    color: '#38BDF8',
    fontSize: 14,
    fontWeight: '800',
    fontFamily: 'monospace'
  },
  actions: {
    gap: 10
  },
  rematchBtn: {
    backgroundColor: '#10B981',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center'
  },
  rematchText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800'
  },
  leaveBtn: {
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EF4444',
    alignItems: 'center'
  },
  leaveText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '700'
  }
});
