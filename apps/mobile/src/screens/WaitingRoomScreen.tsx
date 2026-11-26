import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  CLIMBER_COLORS,
  DEFAULT_MATCH_SETTINGS,
  MatchSettings,
  Player,
  RoomState,
  TIME_LIMIT_PRESETS
} from '@climb/shared';
import { ClimberAvatar } from '../components/MountainArtwork';
import { useLanguage } from '../i18n/LanguageContext';
import { SoundService } from '../services/soundService';

export interface WaitingRoomScreenProps {
  roomState: RoomState;
  playerId: string;
  countdownSeconds: number | null;
  onSelectColor: (color: string) => void;
  onUpdateSettings: (settings: Partial<MatchSettings>) => void;
  onToggleReady: () => void;
  onStartMatch: () => void;
  onLeaveRoom: () => void;
}

function formatPresetMinutes(sec: number): string {
  return `${Math.round(sec / 60)}m`;
}

export const WaitingRoomScreen: React.FC<WaitingRoomScreenProps> = ({
  roomState,
  playerId,
  countdownSeconds,
  onSelectColor,
  onUpdateSettings,
  onToggleReady,
  onStartMatch,
  onLeaveRoom
}) => {
  const { t } = useLanguage();
  const [showShortHandedConfirm, setShowShortHandedConfirm] = useState(false);

  const selfPlayer = roomState.players.find((p) => p.id === playerId);
  const isHost = roomState.hostId === playerId || (selfPlayer?.isHost ?? false);
  const isCountingDown =
    roomState.phase === 'COUNTDOWN' || countdownSeconds !== null;
  const activeCountdown = countdownSeconds ?? roomState.countdownRemaining;

  const readyCount = roomState.players.filter((p) => p.isReady).length;
  const totalCount = roomState.players.length;
  const allReady = totalCount >= 2 && readyCount === totalCount;
  const isSoloWaiting = totalCount < 2;
  const canHostPressStart =
    isHost && totalCount >= 2 && allReady && !isCountingDown;

  const settings = roomState.settings ?? DEFAULT_MATCH_SETTINGS;
  const canEditSettings = isHost && !isCountingDown;

  const takenByOthers = new Set(
    roomState.players
      .filter((p) => p.id !== playerId)
      .map((p) => p.color)
  );

  const emptySlotsCount = Math.max(0, roomState.maxPlayers - totalCount);
  const emptySlots = Array.from({ length: emptySlotsCount }, (_, idx) => idx);

  useEffect(() => {
    if (!canHostPressStart || totalCount >= 4) {
      setShowShortHandedConfirm(false);
    }
  }, [canHostPressStart, totalCount]);

  const getStartButtonLabel = (): string => {
    if (isSoloWaiting) {
      return t.needTwoPlayersBtn;
    }
    if (!allReady) {
      return `${t.waitingForReadyPrefix} (${readyCount}/${totalCount})`;
    }
    return `${t.startMatchPrefix} (${totalCount}/${roomState.maxPlayers})`;
  };

  const handlePressStart = () => {
    if (!canHostPressStart) return;
    SoundService.play('ui_tap');

    if (totalCount === 2 || totalCount === 3) {
      setShowShortHandedConfirm(true);
      return;
    }

    onStartMatch();
  };

  return (
    <View style={styles.wrapper}>
      {/* Room Code Banner */}
      <View style={styles.codeBanner}>
        <View style={styles.peakSilhouetteLeft} />
        <View style={styles.peakSilhouetteRight} />
        <Text style={styles.codeLabel}>{t.onlineRoomCode}</Text>
        <Text style={styles.codeValue}>{roomState.code}</Text>
        <View style={styles.metaPillRow}>
          <View style={styles.metaPill}>
            <Text style={styles.metaPillText}>
              🧗 {totalCount}/{roomState.maxPlayers} {t.climbersCountSuffix}
            </Text>
          </View>
          <View style={styles.metaPill}>
            <Text style={styles.metaPillText}>
              🏔 {roomState.targetHeight}M {t.summitTargetSuffix}
            </Text>
          </View>
        </View>
      </View>

      {/* Unique Climber Color Picker Row */}
      <View style={styles.panelCard}>
        <Text style={styles.panelTitle}>{t.chooseColorLabel}</Text>
        <View style={styles.colorSwatchRow}>
          {CLIMBER_COLORS.map((color) => {
            const isMine = selfPlayer?.color === color;
            const isTaken = takenByOthers.has(color);
            return (
              <Pressable
                key={color}
                disabled={isTaken || isCountingDown}
                style={[
                  styles.colorSwatch,
                  { backgroundColor: color },
                  isMine && styles.colorSwatchMine,
                  isTaken && styles.colorSwatchTaken
                ]}
                onPress={() => {
                  SoundService.play('ui_tap');
                  onSelectColor(color);
                }}
              >
                {isMine && <Text style={styles.swatchGlyph}>✓</Text>}
                {isTaken && <Text style={styles.swatchLockGlyph}>🔒</Text>}
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.colorHintText}>{t.colorTakenHint}</Text>
      </View>

      {/* Pre-Game Match Settings Panel (Host Editable, Guest Read-Only) */}
      <View style={styles.panelCard}>
        <View style={styles.panelHeaderRow}>
          <Text style={styles.panelTitle}>{t.matchRulesTitle}</Text>
          {!isHost && (
            <Text style={styles.hostReadOnlyBadge}>{t.hostRulesHint}</Text>
          )}
        </View>

        <View style={styles.rulesGrid}>
          {/* Falling Boulders */}
          <Pressable
            disabled={!canEditSettings}
            style={[
              styles.ruleChip,
              settings.enableBoulders ? styles.ruleChipOn : styles.ruleChipOff
            ]}
            onPress={() => {
              SoundService.play('ui_tap');
              onUpdateSettings({ enableBoulders: !settings.enableBoulders });
            }}
          >
            <Text style={styles.ruleChipLabel}>🪨 {t.fallingBouldersLabel}</Text>
            <Text
              style={[
                styles.ruleChipState,
                settings.enableBoulders
                  ? styles.ruleStateTextOn
                  : styles.ruleStateTextOff
              ]}
            >
              {settings.enableBoulders ? t.on : t.off}
            </Text>
          </Pressable>

          {/* Icy Ledges */}
          <Pressable
            disabled={!canEditSettings}
            style={[
              styles.ruleChip,
              settings.enableIce ? styles.ruleChipOn : styles.ruleChipOff
            ]}
            onPress={() => {
              SoundService.play('ui_tap');
              onUpdateSettings({ enableIce: !settings.enableIce });
            }}
          >
            <Text style={styles.ruleChipLabel}>🧊 {t.icyLedgesLabel}</Text>
            <Text
              style={[
                styles.ruleChipState,
                settings.enableIce
                  ? styles.ruleStateTextOn
                  : styles.ruleStateTextOff
              ]}
            >
              {settings.enableIce ? t.on : t.off}
            </Text>
          </Pressable>
        </View>

        {/* Time Limit Row */}
        <View style={styles.timeLimitRow}>
          <Text style={styles.timeLimitCaption}>⏱ {t.timeLimitLabel}</Text>
          <View style={styles.timePillsGroup}>
            {TIME_LIMIT_PRESETS.map((sec) => {
              const active = settings.timeLimitSec === sec;
              return (
                <Pressable
                  key={sec}
                  disabled={!canEditSettings}
                  style={[styles.timePill, active && styles.timePillActive]}
                  onPress={() => {
                    SoundService.play('ui_tap');
                    onUpdateSettings({ timeLimitSec: sec });
                  }}
                >
                  <Text
                    style={[
                      styles.timePillText,
                      active && styles.timePillTextActive
                    ]}
                  >
                    {formatPresetMinutes(sec)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>

      {/* Player Roster Card */}
      <View style={styles.rosterCard}>
        <View style={styles.rosterHeader}>
          <Text style={styles.rosterTitle}>{t.climbingCrewTitle}</Text>
          <Text style={styles.rosterProgress}>
            {readyCount}/{totalCount} {t.readyCountSuffix}
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
                <View style={styles.slotAvatarBox}>
                  <ClimberAvatar jacketColor={player.color} scale={0.72} />
                </View>

                <View style={styles.playerDetails}>
                  <Text style={styles.playerNickname} numberOfLines={1}>
                    {player.nickname} {isSelf ? t.youSuffix : ''}
                  </Text>
                  <Text style={styles.slotCaption}>#{index + 1}</Text>
                </View>

                <View style={styles.badgeGroup}>
                  {player.isHost && (
                    <Text style={styles.hostBadge}>{t.hostBadge}</Text>
                  )}
                  <Text
                    style={[
                      styles.readyBadge,
                      player.isReady
                        ? styles.readyBadgeYes
                        : styles.readyBadgeNo
                    ]}
                  >
                    {player.isReady ? t.readyBadge : t.prepBadge}
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
                {t.openSlotPrefix} #{totalCount + slotOffset + 1} —{' '}
                {t.shareCodeLabel} {roomState.code}
              </Text>
            </View>
          ))}
        </View>

        {/* Controls */}
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
              {selfPlayer?.isReady ? t.readyActiveBtn : t.readyUpBtn}
            </Text>
          </Pressable>

          {isHost ? (
            <View>
              <Pressable
                style={({ pressed }) => [
                  styles.button,
                  styles.startMatchBtn,
                  !canHostPressStart && styles.startBtnTranslucentDisabled,
                  pressed && canHostPressStart && styles.buttonPressed
                ]}
                disabled={!canHostPressStart}
                onPress={handlePressStart}
              >
                <Text style={styles.buttonText}>{getStartButtonLabel()}</Text>
              </Pressable>
              {isSoloWaiting && (
                <Text style={styles.soloHelperText}>
                  {t.needTwoPlayersHint}
                </Text>
              )}
            </View>
          ) : (
            <View style={styles.guestNoticeBox}>
              <Text style={styles.guestNoticeText}>
                {allReady ? t.guestAllReadyHint : t.guestPleaseReadyHint}
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
            <Text style={styles.leaveBtnText}>{t.leaveRoomBtn}</Text>
          </Pressable>
        </View>
      </View>

      {/* 2–3 Player Confirmation Popup Modal */}
      <Modal
        visible={showShortHandedConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowShortHandedConfirm(false)}
      >
        <View style={styles.confirmBackdrop}>
          <View style={styles.confirmModal}>
            <Text style={styles.confirmKicker}>{t.shortHandedKicker}</Text>
            <Text style={styles.confirmTitle}>
              {t.shortHandedTitle(totalCount, roomState.maxPlayers)}
            </Text>
            <Text style={styles.confirmSub}>
              {t.shortHandedSub(roomState.code)}
            </Text>

            <View style={styles.confirmBtnRow}>
              <Pressable
                style={styles.confirmCancelBtn}
                onPress={() => {
                  SoundService.play('ui_tap');
                  setShowShortHandedConfirm(false);
                }}
              >
                <Text style={styles.confirmCancelText}>{t.cancel}</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.confirmStartBtn,
                  pressed && styles.buttonPressed
                ]}
                onPress={() => {
                  SoundService.play('ui_tap');
                  setShowShortHandedConfirm(false);
                  onStartMatch();
                }}
              >
                <Text style={styles.confirmStartText}>
                  {t.startAnywayBtn}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Live 3-2-1 Countdown Overlay */}
      {isCountingDown && (
        <View style={styles.countdownOverlay}>
          <View style={styles.countdownModal}>
            <Text style={styles.countdownTitle}>{t.countdownGetReady}</Text>
            <Text style={styles.countdownNumber}>
              {activeCountdown !== null && activeCountdown > 0
                ? activeCountdown
                : t.countdownGo}
            </Text>
            <Text style={styles.countdownSub}>
              {roomState.targetHeight}m • {formatPresetMinutes(settings.timeLimitSec)}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    gap: 12
  },
  codeBanner: {
    backgroundColor: '#13223A',
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 20,
    alignItems: 'center',
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
    letterSpacing: 1.5
  },
  codeValue: {
    fontSize: 40,
    fontWeight: '900',
    color: '#F8FAFC',
    letterSpacing: 8,
    marginVertical: 4
  },
  metaPillRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4
  },
  metaPill: {
    backgroundColor: '#0A1322',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#294266'
  },
  metaPillText: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '800'
  },
  panelCard: {
    backgroundColor: '#132036',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#263B59'
  },
  panelHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  panelTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#CBD5E1',
    letterSpacing: 0.6,
    marginBottom: 8
  },
  hostReadOnlyBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: '#7DD3FC',
    backgroundColor: '#0B1424',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 8
  },
  colorSwatchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  colorSwatch: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)'
  },
  colorSwatchMine: {
    borderColor: '#FFFFFF',
    borderWidth: 3,
    transform: [{ scale: 1.08 }]
  },
  colorSwatchTaken: {
    opacity: 0.3
  },
  swatchGlyph: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900'
  },
  swatchLockGlyph: {
    fontSize: 11
  },
  colorHintText: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 7
  },
  rulesGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10
  },
  ruleChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1
  },
  ruleChipOn: {
    backgroundColor: '#0B1E36',
    borderColor: '#38BDF8'
  },
  ruleChipOff: {
    backgroundColor: '#0B1424',
    borderColor: '#263B59'
  },
  ruleChipLabel: {
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: '800',
    flexShrink: 1,
    marginRight: 4
  },
  ruleChipState: {
    fontSize: 11,
    fontWeight: '900'
  },
  ruleStateTextOn: {
    color: '#34D399'
  },
  ruleStateTextOff: {
    color: '#94A3B8'
  },
  timeLimitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8
  },
  timeLimitCaption: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '800'
  },
  timePillsGroup: {
    flexDirection: 'row',
    backgroundColor: '#09111E',
    borderRadius: 9,
    padding: 3,
    gap: 4
  },
  timePill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 7
  },
  timePillActive: {
    backgroundColor: '#0284C7'
  },
  timePillText: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '800'
  },
  timePillTextActive: {
    color: '#FFFFFF'
  },
  rosterCard: {
    backgroundColor: '#132036',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#263B59'
  },
  rosterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10
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
    gap: 8,
    marginBottom: 16
  },
  playerSlot: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0B1424',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1C2E4A'
  },
  playerSlotSelf: {
    borderColor: '#38BDF8',
    backgroundColor: '#0F1F38'
  },
  slotAvatarBox: {
    width: 34,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10
  },
  emptySlot: {
    backgroundColor: '#09111E',
    borderStyle: 'dashed',
    borderColor: '#263B59',
    paddingVertical: 13
  },
  emptyDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#263B59',
    marginRight: 10,
    marginLeft: 6
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
    fontSize: 14,
    fontWeight: '800',
    color: '#F8FAFC'
  },
  slotCaption: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 1,
    fontWeight: '700'
  },
  badgeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  hostBadge: {
    backgroundColor: '#FACC15',
    color: '#0F172A',
    fontSize: 9,
    fontWeight: '900',
    paddingHorizontal: 6,
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
    gap: 9
  },
  button: {
    paddingVertical: 13,
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
  startBtnTranslucentDisabled: {
    opacity: 0.35
  },
  soloHelperText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 16
  },
  leaveBtn: {
    paddingVertical: 12,
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
  confirmBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(6, 11, 22, 0.86)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 22
  },
  confirmModal: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#13223A',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1.5,
    borderColor: '#F59E0B'
  },
  confirmKicker: {
    color: '#FBBF24',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2
  },
  confirmTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 4,
    lineHeight: 24
  },
  confirmSub: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 6,
    marginBottom: 18,
    lineHeight: 18,
    fontWeight: '600'
  },
  confirmBtnRow: {
    flexDirection: 'row',
    gap: 10
  },
  confirmCancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center'
  },
  confirmCancelText: {
    color: '#CBD5E1',
    fontSize: 14,
    fontWeight: '800'
  },
  confirmStartBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: '#EA580C',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 4,
    borderBottomColor: '#9A3412'
  },
  confirmStartText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900'
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
