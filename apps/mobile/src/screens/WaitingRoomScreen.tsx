import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Player, RoomState } from '@climb/shared';

export interface WaitingRoomScreenProps {
  roomState: RoomState;
  playerId: string;
  countdownSeconds: number | null;
  onToggleReady: () => void;
  onStartMatch: () => void;
  onLeaveRoom: () => void;
}

export const WaitingRoomScreen: React.FC<WaitingRoomScreenProps> = ({
  roomState,
  playerId,
  countdownSeconds,
  onToggleReady,
  onStartMatch,
  onLeaveRoom
}) => {
  const selfPlayer = roomState.players.find((p) => p.id === playerId);
  const isHost = roomState.hostId === playerId || (selfPlayer?.isHost ?? false);
  const isCountingDown =
    roomState.phase === 'COUNTDOWN' || countdownSeconds !== null;
  const activeCountdown = countdownSeconds ?? roomState.countdownRemaining;

  const readyCount = roomState.players.filter((p) => p.isReady).length;
  const totalCount = roomState.players.length;
  const allReady = totalCount >= 1 && readyCount === totalCount;
  const canStart = isHost && allReady && !isCountingDown;

  const emptySlotsCount = Math.max(0, roomState.maxPlayers - totalCount);
  const emptySlots = Array.from({ length: emptySlotsCount }, (_, idx) => idx);

  const getStartButtonLabel = (): string => {
    if (!allReady) {
      return `Waiting for Ready (${readyCount}/${totalCount})`;
    }
    if (totalCount === 1) {
      return 'Start Match (Solo Test)';
    }
    return `Start Match (${totalCount} Climbers)`;
  };

  return (
    <View style={styles.wrapper}>
      {/* Room Code Hero Card */}
      <View style={styles.codeBanner}>
        <Text style={styles.codeLabel}>WAITING ROOM CODE</Text>
        <Text style={styles.codeValue}>{roomState.code}</Text>
        <View style={styles.metaPillRow}>
          <View style={styles.metaPill}>
            <Text style={styles.metaPillText}>
              {totalCount}/{roomState.maxPlayers} CLIMBERS
            </Text>
          </View>
          <View style={styles.metaPill}>
            <Text style={styles.metaPillText}>
              SUMMIT: {roomState.targetHeight}m
            </Text>
          </View>
        </View>
      </View>

      {/* Player Roster Card */}
      <View style={styles.rosterCard}>
        <View style={styles.rosterHeader}>
          <Text style={styles.rosterTitle}>CLIMBER ROSTER</Text>
          <Text style={styles.rosterProgress}>
            {readyCount}/{totalCount} Ready
          </Text>
        </View>

        <View style={styles.slotList}>
          {roomState.players.map((player: Player, index: number) => {
            const isSelf = player.id === playerId;
            return (
              <View
                key={player.id}
                style={[styles.playerSlot, isSelf && styles.playerSlotSelf]}
              >
                <View
                  style={[
                    styles.colorSwatch,
                    { backgroundColor: player.color }
                  ]}
                />
                <View style={styles.playerDetails}>
                  <Text style={styles.playerNickname} numberOfLines={1}>
                    {player.nickname} {isSelf ? '(You)' : ''}
                  </Text>
                  <Text style={styles.slotCaption}>Lane #{index + 1}</Text>
                </View>

                <View style={styles.badgeGroup}>
                  {player.isHost && <Text style={styles.hostBadge}>HOST</Text>}
                  <Text
                    style={[
                      styles.readyBadge,
                      player.isReady
                        ? styles.readyBadgeYes
                        : styles.readyBadgeNo
                    ]}
                  >
                    {player.isReady ? 'READY' : 'NOT READY'}
                  </Text>
                </View>
              </View>
            );
          })}

          {emptySlots.map((slotOffset) => (
            <View
              key={`empty-${slotOffset}`}
              style={[styles.playerSlot, styles.emptySlot]}
            >
              <View style={styles.emptyDot} />
              <Text style={styles.emptySlotText}>
                Open Slot #{totalCount + slotOffset + 1} — Share code{' '}
                {roomState.code}
              </Text>
            </View>
          ))}
        </View>

        {/* Controls */}
        <View style={styles.controlsColumn}>
          <TouchableOpacity
            style={[
              styles.button,
              selfPlayer?.isReady ? styles.readyActiveBtn : styles.readyIdleBtn,
              isCountingDown && styles.buttonDisabled
            ]}
            disabled={isCountingDown}
            onPress={onToggleReady}
          >
            <Text style={styles.buttonText}>
              {selfPlayer?.isReady
                ? 'Ready ✓ (Tap to Unready)'
                : 'Ready Up!'}
            </Text>
          </TouchableOpacity>

          {isHost ? (
            <TouchableOpacity
              style={[
                styles.button,
                styles.startMatchBtn,
                !canStart && styles.buttonDisabled
              ]}
              disabled={!canStart}
              onPress={onStartMatch}
            >
              <Text style={styles.buttonText}>{getStartButtonLabel()}</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.guestNoticeBox}>
              <Text style={styles.guestNoticeText}>
                {allReady
                  ? 'All climbers ready! Waiting for Host to start...'
                  : 'Tap "Ready Up!" so the Host can start the climb.'}
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.button,
              styles.leaveBtn,
              isCountingDown && styles.buttonDisabled
            ]}
            disabled={isCountingDown}
            onPress={onLeaveRoom}
          >
            <Text style={styles.leaveBtnText}>Leave Room</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Live 3-2-1 Countdown Overlay */}
      {isCountingDown && (
        <View style={styles.countdownOverlay}>
          <View style={styles.countdownModal}>
            <Text style={styles.countdownTitle}>GET READY TO CLIMB!</Text>
            <Text style={styles.countdownNumber}>
              {activeCountdown !== null && activeCountdown > 0
                ? activeCountdown
                : 'GO!'}
            </Text>
            <Text style={styles.countdownMeta}>
              PRNG Seed Locked: 0x{roomState.seed.toString(16).toUpperCase()}
            </Text>
            <Text style={styles.countdownSub}>
              Target Summit: {roomState.targetHeight}m
            </Text>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative'
  },
  codeBanner: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    paddingVertical: 22,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#38BDF8'
  },
  codeLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 1.5
  },
  codeValue: {
    fontSize: 44,
    fontWeight: '900',
    color: '#38BDF8',
    letterSpacing: 8,
    marginVertical: 6
  },
  metaPillRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4
  },
  metaPill: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155'
  },
  metaPillText: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '700'
  },
  rosterCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#334155'
  },
  rosterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  rosterTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.8
  },
  rosterProgress: {
    fontSize: 12,
    fontWeight: '700',
    color: '#34D399'
  },
  slotList: {
    gap: 10,
    marginBottom: 20
  },
  playerSlot: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E293B'
  },
  playerSlotSelf: {
    borderColor: '#3B82F6'
  },
  emptySlot: {
    backgroundColor: '#0B1324',
    borderStyle: 'dashed',
    borderColor: '#334155',
    paddingVertical: 14
  },
  colorSwatch: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 12
  },
  emptyDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#334155',
    marginRight: 12
  },
  emptySlotText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600'
  },
  playerDetails: {
    flex: 1,
    marginRight: 8
  },
  playerNickname: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F8FAFC'
  },
  slotCaption: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2
  },
  badgeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  hostBadge: {
    backgroundColor: '#FACC15',
    color: '#0F172A',
    fontSize: 10,
    fontWeight: '900',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4
  },
  readyBadge: {
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4
  },
  readyBadgeYes: {
    backgroundColor: '#065F46',
    color: '#34D399'
  },
  readyBadgeNo: {
    backgroundColor: '#334155',
    color: '#94A3B8'
  },
  controlsColumn: {
    gap: 10
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  readyIdleBtn: {
    backgroundColor: '#2563EB'
  },
  readyActiveBtn: {
    backgroundColor: '#059669'
  },
  startMatchBtn: {
    backgroundColor: '#EA580C'
  },
  leaveBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#EF4444',
    marginTop: 4
  },
  buttonDisabled: {
    opacity: 0.45
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15
  },
  leaveBtnText: {
    color: '#EF4444',
    fontWeight: '700',
    fontSize: 14
  },
  guestNoticeBox: {
    backgroundColor: '#0F172A',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155'
  },
  guestNoticeText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center'
  },
  countdownOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24
  },
  countdownModal: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    paddingVertical: 32,
    paddingHorizontal: 28,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#F59E0B',
    width: '100%'
  },
  countdownTitle: {
    color: '#FBBF24',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1.5
  },
  countdownNumber: {
    color: '#FFFFFF',
    fontSize: 76,
    fontWeight: '900',
    marginVertical: 12
  },
  countdownMeta: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'monospace'
  },
  countdownSub: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '600'
  }
});
