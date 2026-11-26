import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  GAME_CONSTANTS,
  generateObstaclePattern,
  PlayerMoveAction,
  RoomState,
  SanitizedPlayerPosition
} from '@climb/shared';
import { MoveSubmission } from '../hooks/useMultiplayerLobby';
import { HapticsService } from '../haptics/hapticsService';

export interface GameScreenProps {
  roomState: RoomState;
  playerId: string;
  livePlayers: SanitizedPlayerPosition[];
  onSendMove: (move: MoveSubmission) => void;
  onLeaveRoom: () => void;
}

/**
 * Interactive Match Harness & Placeholder GameScreen.
 * Verifies deterministic Mulberry32 obstacle generation from the server seed,
 * sends real-time `player:move` updates, and renders live `match:state` rival positions.
 */
export const GameScreen: React.FC<GameScreenProps> = ({
  roomState,
  playerId,
  livePlayers,
  onSendMove,
  onLeaveRoom
}) => {
  const selfServerState = livePlayers.find((p) => p.id === playerId);
  const [localHeight, setLocalHeight] = useState<number>(
    selfServerState?.height ?? 0
  );
  const [localX, setLocalX] = useState<number>(selfServerState?.x ?? 180);

  const obstacles = useMemo(
    () =>
      generateObstaclePattern({
        seed: roomState.seed,
        goalHeight: roomState.targetHeight
      }),
    [roomState.seed, roomState.targetHeight]
  );

  const handleClimbStep = (action: PlayerMoveAction, deltaX: number) => {
    const nextHeight = Math.min(roomState.targetHeight, localHeight + 25);
    const nextX = Math.max(
      20,
      Math.min(GAME_CONSTANTS.WORLD_WIDTH - 20, localX + deltaX)
    );
    setLocalHeight(nextHeight);
    setLocalX(nextX);
    void HapticsService.jump();

    onSendMove({
      x: nextX,
      height: nextHeight,
      action,
      status: nextHeight >= roomState.targetHeight ? 'FINISHED' : 'CLIMBING'
    });
  };

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View>
          <Text style={styles.badgeText}>LIVE MATCH • ROOM {roomState.code}</Text>
          <Text style={styles.title}>Summit Race ({roomState.targetHeight}m)</Text>
        </View>
        <View style={styles.seedBadge}>
          <Text style={styles.seedText}>
            Seed 0x{roomState.seed.toString(16).toUpperCase()}
          </Text>
          <Text style={styles.obsSub}>{obstacles.length} Obstacles</Text>
        </View>
      </View>

      {/* Live Race Altitude Standings */}
      <View style={styles.standingsSection}>
        <Text style={styles.sectionLabel}>LIVE CLIMBER ALTITUDE</Text>
        {livePlayers.map((climber) => {
          const progressPct = Math.min(
            100,
            Math.max(0, (climber.height / roomState.targetHeight) * 100)
          );
          const isSelf = climber.id === playerId;
          return (
            <View key={climber.id} style={styles.trackRow}>
              <View style={styles.trackHeader}>
                <View style={styles.nameRow}>
                  <View
                    style={[styles.dot, { backgroundColor: climber.color }]}
                  />
                  <Text style={styles.climberName}>
                    {climber.nickname} {isSelf ? '(You)' : ''}
                  </Text>
                </View>
                <Text style={styles.altitudeValue}>
                  {Math.round(climber.height)}m / {roomState.targetHeight}m
                </Text>
              </View>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${progressPct}%`,
                      backgroundColor: climber.color
                    }
                  ]}
                />
              </View>
            </View>
          );
        })}
      </View>

      {/* Placeholder Tap Climb Controls (To be replaced by full Vertical Climb Canvas) */}
      <View style={styles.controlsBox}>
        <Text style={styles.controlsHint}>
          Tap Left / Right to climb (+25m per step) and test server-authoritative
          sync:
        </Text>
        <View style={styles.tapRow}>
          <TouchableOpacity
            style={[styles.tapButton, styles.tapLeft]}
            onPress={() => handleClimbStep('TAP_LEFT', -24)}
          >
            <Text style={styles.tapLabel}>◀ TAP LEFT</Text>
            <Text style={styles.tapSub}>+25m Climb</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tapButton, styles.tapRight]}
            onPress={() => handleClimbStep('TAP_RIGHT', 24)}
          >
            <Text style={styles.tapLabel}>TAP RIGHT ▶</Text>
            <Text style={styles.tapSub}>+25m Climb</Text>
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity style={styles.leaveBtn} onPress={onLeaveRoom}>
        <Text style={styles.leaveText}>Forfeit & Leave Match</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#334155'
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#334155'
  },
  badgeText: {
    color: '#4ADE80',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1
  },
  title: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: '900',
    marginTop: 2
  },
  seedBadge: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'flex-end',
    borderWidth: 1,
    borderColor: '#334155'
  },
  seedText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'monospace'
  },
  obsSub: {
    color: '#64748B',
    fontSize: 10,
    marginTop: 2
  },
  standingsSection: {
    gap: 12,
    marginBottom: 20
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.8
  },
  trackRow: {
    backgroundColor: '#0F172A',
    padding: 12,
    borderRadius: 10
  },
  trackHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8
  },
  climberName: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '700'
  },
  altitudeValue: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'monospace'
  },
  progressTrack: {
    height: 10,
    backgroundColor: '#1E293B',
    borderRadius: 5,
    overflow: 'hidden'
  },
  progressFill: {
    height: '100%',
    borderRadius: 5
  },
  controlsBox: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#334155'
  },
  controlsHint: {
    color: '#94A3B8',
    fontSize: 12,
    marginBottom: 12,
    textAlign: 'center'
  },
  tapRow: {
    flexDirection: 'row',
    gap: 12
  },
  tapButton: {
    flex: 1,
    paddingVertical: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  tapLeft: {
    backgroundColor: '#2563EB'
  },
  tapRight: {
    backgroundColor: '#7C3AED'
  },
  tapLabel: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900'
  },
  tapSub: {
    color: '#E2E8F0',
    fontSize: 11,
    marginTop: 4,
    fontWeight: '600'
  },
  leaveBtn: {
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#EF4444',
    alignItems: 'center'
  },
  leaveText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '700'
  }
});
