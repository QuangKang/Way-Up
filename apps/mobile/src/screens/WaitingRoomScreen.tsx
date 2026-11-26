import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
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
      return `Waiting for Crew (${readyCount}/${totalCount} Ready)`;
    }
    if (totalCount === 1) {
      return '▲ Launch Solo Ascent';
    }
    return `▲ Launch Ascent (${totalCount} Climbers)`;
  };

  return (
    <View style={styles.wrapper}>
      {/* Room Code Basecamp Banner */}
      <View style={styles.codeBanner}>
        <View style={styles.peakSilhouetteLeft} />
        <View style={styles.peakSilhouetteRight} />
        <Text style={styles.codeLabel}>EXPEDITION ROOM CODE</Text>
        <Text style={styles.codeValue}>{roomState.code}</Text>
        <View style={styles.metaPillRow}>
          <View style={styles.metaPill}>
            <Text style={styles.metaPillText}>
              🧗 {totalCount}/{roomState.maxPlayers} CLIMBERS
            </Text>
          </View>
          <View style={styles.metaPill}>
            <Text style={styles.metaPillText}>
              🏔 {roomState.targetHeight}M SUMMIT
            </Text>
          </View>
        </View>
      </View>

      {/* Player Roster Card */}
      <View style={styles.rosterCard}>
        <View style={styles.rosterHeader}>
          <Text style={styles.rosterTitle}>CLIMBING CREW</Text>
          <Text style={styles.rosterProgress}>
            {readyCount}/{totalCount} Rope-Ready
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
                {/* Mini Climber Helmet Swatch */}
                <View
                  style={[
                    styles.helmetBadge,
                    { backgroundColor: player.color }
                  ]}
                >
                  <View style={styles.helmetGoggles} />
                </View>

                <View style={styles.playerDetails}>
                  <Text style={styles.playerNickname} numberOfLines={1}>
                    {player.nickname} {isSelf ? '(You)' : ''}
                  </Text>
                  <Text style={styles.slotCaption}>
                    Climber #{index + 1} • Rope Team
                  </Text>
                </View>

                <View style={styles.badgeGroup}>
                  {player.isHost && <Text style={styles.hostBadge}>LEAD</Text>}
                  <Text
                    style={[
                      styles.readyBadge,
                      player.isReady
                        ? styles.readyBadgeYes
                        : styles.readyBadgeNo
                    ]}
                  >
                    {player.isReady ? 'READY' : 'PREP'}
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
                Open Rope Slot #{totalCount + slotOffset + 1} — Share{' '}
                {roomState.code}
              </Text>
            </View>
          ))}
        </View>

        {/* Tactile Controls */}
        <View style={styles.controlsColumn}>
          <Pressable
            style={({ pressed }) => [
              styles.button,
              selfPlayer?.isReady ? styles.readyActiveBtn : styles.readyIdleBtn,
              isCountingDown && styles.buttonDisabled,
              pressed && !isCountingDown && styles.buttonPressed
            ]}
            disabled={isCountingDown}
            onPress={onToggleReady}
          >
            <Text style={styles.buttonText}>
              {selfPlayer?.isReady
                ? '✓ Gear Checked (Tap to Stand Down)'
                : 'Check Gear — Ready Up!'}
            </Text>
          </Pressable>

          {isHost ? (
            <Pressable
              style={({ pressed }) => [
                styles.button,
                styles.startMatchBtn,
                !canStart && styles.buttonDisabled,
                pressed && canStart && styles.buttonPressed
              ]}
              disabled={!canStart}
              onPress={onStartMatch}
            >
              <Text style={styles.buttonText}>{getStartButtonLabel()}</Text>
            </Pressable>
          ) : (
            <View style={styles.guestNoticeBox}>
              <Text style={styles.guestNoticeText}>
                {allReady
                  ? 'All climbers roped in! Waiting for Expedition Lead to launch...'
                  : 'Tap "Ready Up!" so the Expedition Lead can start the ascent.'}
              </Text>
            </View>
          )}

          <Pressable
            style={({ pressed }) => [
              styles.leaveBtn,
              isCountingDown && styles.buttonDisabled,
              pressed && !isCountingDown && styles.leaveBtnPressed
            ]}
            disabled={isCountingDown}
            onPress={onLeaveRoom}
          >
            <Text style={styles.leaveBtnText}>Leave Basecamp</Text>
          </Pressable>
        </View>
      </View>

      {/* Live 3-2-1 Countdown Overlay */}
      {isCountingDown && (
        <View style={styles.countdownOverlay}>
          <View style={styles.countdownModal}>
            <Text style={styles.countdownTitle}>ROPES LOCKED • CLIMB!</Text>
            <Text style={styles.countdownNumber}>
              {activeCountdown !== null && activeCountdown > 0
                ? activeCountdown
                : 'GO!'}
            </Text>
            <Text style={styles.countdownSub}>
              Summit Target: {roomState.targetHeight}m • Route #
              {roomState.seed.toString(16).toUpperCase().slice(0, 6)}
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
    backgroundColor: '#13223A',
    borderRadius: 18,
    paddingVertical: 22,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: '#38BDF8',
    overflow: 'hidden'
  },
  peakSilhouetteLeft: {
    position: 'absolute',
    bottom: -36,
    left: -18,
    width: 96,
    height: 96,
    backgroundColor: '#1B3152',
    transform: [{ rotate: '45deg' }],
    opacity: 0.45
  },
  peakSilhouetteRight: {
    position: 'absolute',
    bottom: -44,
    right: -14,
    width: 112,
    height: 112,
    backgroundColor: '#1B3152',
    transform: [{ rotate: '45deg' }],
    opacity: 0.45
  },
  codeLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: '#7DD3FC',
    letterSpacing: 1.6
  },
  codeValue: {
    fontSize: 44,
    fontWeight: '900',
    color: '#F8FAFC',
    letterSpacing: 8,
    marginVertical: 6
  },
  metaPillRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4
  },
  metaPill: {
    backgroundColor: '#0A1322',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#294266'
  },
  metaPillText: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '800'
  },
  rosterCard: {
    backgroundColor: '#132036',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#263B59'
  },
  rosterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  rosterTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#94A3B8',
    letterSpacing: 1
  },
  rosterProgress: {
    fontSize: 12,
    fontWeight: '800',
    color: '#34D399'
  },
  slotList: {
    gap: 10,
    marginBottom: 18
  },
  playerSlot: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0B1424',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1C2E4A'
  },
  playerSlotSelf: {
    borderColor: '#38BDF8',
    backgroundColor: '#0F1F38'
  },
  emptySlot: {
    backgroundColor: '#09111E',
    borderStyle: 'dashed',
    borderColor: '#263B59',
    paddingVertical: 14
  },
  helmetBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)'
  },
  helmetGoggles: {
    width: 14,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#0F172A'
  },
  emptyDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#263B59',
    marginRight: 12
  },
  emptySlotText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '700'
  },
  playerDetails: {
    flex: 1,
    marginRight: 8
  },
  playerNickname: {
    fontSize: 15,
    fontWeight: '800',
    color: '#F8FAFC'
  },
  slotCaption: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '600'
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
    borderRadius: 5
  },
  readyBadge: {
    fontSize: 10,
    fontWeight: '900',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 5
  },
  readyBadgeYes: {
    backgroundColor: '#065F46',
    color: '#34D399'
  },
  readyBadgeNo: {
    backgroundColor: '#1E293B',
    color: '#94A3B8'
  },
  controlsColumn: {
    gap: 10
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 4
  },
  buttonPressed: {
    transform: [{ translateY: 2 }],
    borderBottomWidth: 2
  },
  readyIdleBtn: {
    backgroundColor: '#0284C7',
    borderBottomColor: '#075985'
  },
  readyActiveBtn: {
    backgroundColor: '#059669',
    borderBottomColor: '#065F46'
  },
  startMatchBtn: {
    backgroundColor: '#EA580C',
    borderBottomColor: '#9A3412'
  },
  leaveBtn: {
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EF4444',
    alignItems: 'center',
    marginTop: 2
  },
  leaveBtnPressed: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)'
  },
  buttonDisabled: {
    opacity: 0.45
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 15
  },
  leaveBtnText: {
    color: '#F87171',
    fontWeight: '800',
    fontSize: 14
  },
  guestNoticeBox: {
    backgroundColor: '#0B1424',
    borderRadius: 11,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#263B59'
  },
  guestNoticeText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center'
  },
  countdownOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(8, 15, 28, 0.9)',
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24
  },
  countdownModal: {
    backgroundColor: '#13223A',
    borderRadius: 22,
    paddingVertical: 32,
    paddingHorizontal: 26,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#F59E0B',
    width: '100%'
  },
  countdownTitle: {
    color: '#FBBF24',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.5
  },
  countdownNumber: {
    color: '#FFFFFF',
    fontSize: 78,
    fontWeight: '900',
    marginVertical: 10
  },
  countdownSub: {
    color: '#7DD3FC',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '800'
  }
});
