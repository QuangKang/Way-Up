import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { HowToPlayModal } from '../components/HowToPlayModal';
import { OfflineRecordsView } from '../components/OfflineRecordsView';
import { HapticsService } from '../haptics/hapticsService';

export interface LobbyScreenProps {
  playerId: string;
  isConnecting: boolean;
  isConnected: boolean;
  serverError: string | null;
  onClearError: () => void;
  onCreateOnlineRoom: () => void;
  onJoinOnlineRoom: (roomCode: string) => void;
  onStartOfflineMatch: () => void;
}

export const LobbyScreen: React.FC<LobbyScreenProps> = ({
  playerId,
  isConnecting,
  isConnected,
  serverError,
  onClearError,
  onCreateOnlineRoom,
  onJoinOnlineRoom,
  onStartOfflineMatch
}) => {
  const [onlineExpanded, setOnlineExpanded] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [localJoinError, setLocalJoinError] = useState<string | null>(null);
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [showRecordsModal, setShowRecordsModal] = useState(false);

  const cleanedCode = joinCode.trim().toUpperCase();
  const canUseOnline = isConnected && !isConnecting;

  const handleSubmitJoin = () => {
    if (cleanedCode.length !== 4) {
      setLocalJoinError('Enter a 4-character room code.');
      return;
    }
    if (!canUseOnline) {
      setLocalJoinError('Server is offline. Check your Wi-Fi connection.');
      return;
    }
    setLocalJoinError(null);
    onClearError();
    void HapticsService.selection();
    onJoinOnlineRoom(cleanedCode);
  };

  return (
    <View style={styles.wrapper}>
      {/* Scenic Expedition Stage + Side Circular Action Buttons (📖 & 🏆) */}
      <View style={styles.stageCard}>
        {/* Background Mountain Silhouettes */}
        <View style={styles.bgPeakLeft} />
        <View style={styles.bgPeakCenter}>
          <View style={styles.bgPeakCenterSnow} />
        </View>
        <View style={styles.bgPeakRight} />

        <View style={styles.stageContentRow}>
          <View style={styles.stageCopyCol}>
            <View style={styles.goalBadge}>
              <Text style={styles.goalBadgeText}>500M ALPINE ASCENT</Text>
            </View>
            <Text style={styles.stageHeadline}>Conquer the Peak</Text>
            <Text style={styles.stageSub}>
              Race up snow-capped crags, leap off icy holds before you slip, and
              dodge tumbling boulders!
            </Text>
          </View>

          {/* Side Circular Icon Buttons: Book (How to Play) & Trophy (Records) */}
          <View style={styles.sideActionCol}>
            <Pressable
              accessibilityLabel="How to Play"
              style={({ pressed }) => [
                styles.circleIconBtn,
                pressed && styles.circleIconBtnPressed
              ]}
              onPress={() => {
                void HapticsService.selection();
                setShowHowToPlay(true);
              }}
            >
              <Text style={styles.circleIconGlyph}>📖</Text>
            </Pressable>

            <Pressable
              accessibilityLabel="Personal Best Records"
              style={({ pressed }) => [
                styles.circleIconBtn,
                styles.circleTrophyBtn,
                pressed && styles.circleIconBtnPressed
              ]}
              onPress={() => {
                void HapticsService.selection();
                setShowRecordsModal(true);
              }}
            >
              <Text style={styles.circleIconGlyph}>🏆</Text>
            </Pressable>
          </View>
        </View>
      </View>

      {/* Primary Mode Selection: ONLINE & OFFLINE */}
      <View style={styles.modesColumn}>
        {/* ONLINE PRIMARY BUTTON */}
        <Pressable
          style={({ pressed }) => [
            styles.modePrimaryBtn,
            styles.onlineBtn,
            onlineExpanded && styles.onlineBtnExpanded,
            pressed && styles.modeBtnPressed
          ]}
          onPress={() => {
            void HapticsService.selection();
            setOnlineExpanded((prev) => !prev);
          }}
        >
          <View style={styles.modeBtnMainRow}>
            <View>
              <Text style={styles.modeBtnTitle}>ONLINE</Text>
              <Text style={styles.modeBtnSub}>
                2–4 Climbers • Real-Time Ghost Race
              </Text>
            </View>
            <View style={styles.modeChevronPill}>
              <Text style={styles.modeChevronText}>
                {onlineExpanded ? '▲' : '▼'}
              </Text>
            </View>
          </View>
        </Pressable>

        {/* Expanded Online Sub-Options: Create Room & Join Room */}
        {onlineExpanded && (
          <View style={styles.onlineDrawer}>
            {!canUseOnline && (
              <View style={styles.offlineNoticeRow}>
                <View style={styles.offlineDot} />
                <Text style={styles.offlineNoticeText}>
                  {isConnecting
                    ? 'Connecting to multiplayer server...'
                    : 'Server offline — Online rooms unavailable (Offline mode ready below)'}
                </Text>
              </View>
            )}

            <View style={styles.onlineSubActionsRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.subOptionBtn,
                  styles.createRoomBtn,
                  !canUseOnline && styles.subOptionDisabled,
                  pressed && canUseOnline && styles.subOptionPressed
                ]}
                disabled={!canUseOnline}
                onPress={() => {
                  void HapticsService.selection();
                  onClearError();
                  onCreateOnlineRoom();
                }}
              >
                <Text style={styles.subOptionTitle}>Create Room</Text>
                <Text style={styles.subOptionHint}>Host 4-Player Lobby</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.subOptionBtn,
                  styles.joinRoomBtn,
                  !canUseOnline && styles.subOptionDisabled,
                  pressed && canUseOnline && styles.subOptionPressed
                ]}
                disabled={!canUseOnline}
                onPress={() => {
                  void HapticsService.selection();
                  setJoinCode('');
                  setLocalJoinError(null);
                  onClearError();
                  setShowJoinModal(true);
                }}
              >
                <Text style={styles.subOptionTitle}>Join Room</Text>
                <Text style={styles.subOptionHint}>Enter 4-Char Code</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* OFFLINE PRIMARY BUTTON */}
        <Pressable
          style={({ pressed }) => [
            styles.modePrimaryBtn,
            styles.offlineBtn,
            pressed && styles.modeBtnPressed
          ]}
          onPress={() => {
            void HapticsService.selection();
            onStartOfflineMatch();
          }}
        >
          <View style={styles.modeBtnMainRow}>
            <View>
              <Text style={styles.modeBtnTitle}>OFFLINE</Text>
              <Text style={styles.offlineBtnSub}>
                Solo Race vs 3 AI Climbers • Instant Start
              </Text>
            </View>
            <View style={styles.playGoPill}>
              <Text style={styles.playGoPillText}>PLAY ▶</Text>
            </View>
          </View>
        </Pressable>
      </View>

      {/* Join Room 4-Character Code Modal */}
      <Modal
        visible={showJoinModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowJoinModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.joinModalCard}>
            <Text style={styles.modalKicker}>MULTIPLAYER CREW</Text>
            <Text style={styles.modalTitle}>Join Online Room</Text>
            <Text style={styles.modalSub}>
              Enter the 4-character room code shared by the host.
            </Text>

            <TextInput
              style={styles.codeInput}
              placeholder="ABCD"
              placeholderTextColor="#475569"
              autoCapitalize="characters"
              autoCorrect={false}
              autoFocus
              maxLength={4}
              value={joinCode}
              onChangeText={(text) => {
                setLocalJoinError(null);
                if (serverError) {
                  onClearError();
                }
                setJoinCode(text.replace(/[^a-zA-Z0-9]/g, '').toUpperCase());
              }}
              returnKeyType="go"
              onSubmitEditing={handleSubmitJoin}
            />

            {(localJoinError || serverError) && (
              <View style={styles.inlineErrorBox}>
                <Text style={styles.inlineErrorText}>
                  {localJoinError ?? serverError}
                </Text>
              </View>
            )}

            <View style={styles.modalActionRow}>
              <Pressable
                style={styles.modalCancelBtn}
                onPress={() => {
                  onClearError();
                  setLocalJoinError(null);
                  setShowJoinModal(false);
                }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.modalConfirmBtn,
                  cleanedCode.length !== 4 && styles.subOptionDisabled,
                  pressed && cleanedCode.length === 4 && styles.subOptionPressed
                ]}
                disabled={cleanedCode.length !== 4}
                onPress={handleSubmitJoin}
              >
                <Text style={styles.modalConfirmText}>Join</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Book Icon -> How to Play Modal */}
      <HowToPlayModal
        visible={showHowToPlay}
        onClose={() => setShowHowToPlay(false)}
      />

      {/* Trophy Icon -> Personal Best Records Modal */}
      <Modal
        visible={showRecordsModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRecordsModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.recordsModalCard}>
            <View style={styles.recordsModalHeader}>
              <View>
                <Text style={styles.modalKicker}>SUMMIT LOGBOOK</Text>
                <Text style={styles.modalTitle}>Personal Best Ascents</Text>
              </View>
              <Pressable
                style={styles.recordsCloseBtn}
                onPress={() => setShowRecordsModal(false)}
              >
                <Text style={styles.recordsCloseText}>✕</Text>
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <OfflineRecordsView playerId={playerId} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    gap: 14
  },
  stageCard: {
    backgroundColor: '#12213A',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1.5,
    borderColor: '#263F66',
    overflow: 'hidden',
    position: 'relative'
  },
  bgPeakLeft: {
    position: 'absolute',
    bottom: -56,
    left: -16,
    width: 124,
    height: 124,
    backgroundColor: '#182C4D',
    transform: [{ rotate: '45deg' }],
    borderRadius: 10
  },
  bgPeakCenter: {
    position: 'absolute',
    bottom: -64,
    left: '34%',
    width: 142,
    height: 142,
    backgroundColor: '#1D355C',
    transform: [{ rotate: '45deg' }],
    borderRadius: 12,
    overflow: 'hidden'
  },
  bgPeakCenterSnow: {
    width: 44,
    height: 44,
    backgroundColor: 'rgba(241, 245, 249, 0.2)'
  },
  bgPeakRight: {
    position: 'absolute',
    bottom: -60,
    right: -18,
    width: 130,
    height: 130,
    backgroundColor: '#172A49',
    transform: [{ rotate: '45deg' }],
    borderRadius: 10
  },
  stageContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14
  },
  stageCopyCol: {
    flex: 1
  },
  goalBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(251, 191, 36, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.42)',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 8
  },
  goalBadgeText: {
    color: '#FBBF24',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.9
  },
  stageHeadline: {
    color: '#F8FAFC',
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 5
  },
  stageSub: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600'
  },
  sideActionCol: {
    gap: 10,
    alignItems: 'center'
  },
  circleIconBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#0E1B30',
    borderWidth: 1.5,
    borderColor: '#38BDF8',
    borderBottomWidth: 4,
    borderBottomColor: '#0369A1',
    alignItems: 'center',
    justifyContent: 'center'
  },
  circleTrophyBtn: {
    borderColor: '#FBBF24',
    borderBottomColor: '#B45309'
  },
  circleIconBtnPressed: {
    transform: [{ translateY: 2 }],
    borderBottomWidth: 2
  },
  circleIconGlyph: {
    fontSize: 21
  },
  modesColumn: {
    gap: 12
  },
  modePrimaryBtn: {
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderWidth: 1.5,
    borderBottomWidth: 5
  },
  modeBtnPressed: {
    transform: [{ translateY: 2 }],
    borderBottomWidth: 3
  },
  onlineBtn: {
    backgroundColor: '#0284C7',
    borderColor: '#7DD3FC',
    borderBottomColor: '#075985'
  },
  onlineBtnExpanded: {
    backgroundColor: '#0369A1'
  },
  offlineBtn: {
    backgroundColor: '#EA580C',
    borderColor: '#FDBA74',
    borderBottomColor: '#9A3412'
  },
  modeBtnMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  modeBtnTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 1.2
  },
  modeBtnSub: {
    color: '#E0F2FE',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2
  },
  offlineBtnSub: {
    color: '#FFEDD5',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2
  },
  modeChevronPill: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(15, 23, 42, 0.28)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  modeChevronText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900'
  },
  playGoPill: {
    backgroundColor: 'rgba(15, 23, 42, 0.28)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12
  },
  playGoPillText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8
  },
  onlineDrawer: {
    backgroundColor: '#0E1A2E',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#26426B',
    gap: 10,
    marginTop: -4
  },
  offlineNoticeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(127, 29, 29, 0.35)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.4)'
  },
  offlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F87171',
    marginRight: 8
  },
  offlineNoticeText: {
    flex: 1,
    color: '#FECACA',
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 15
  },
  onlineSubActionsRow: {
    flexDirection: 'row',
    gap: 10
  },
  subOptionBtn: {
    flex: 1,
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderRadius: 13,
    alignItems: 'center',
    borderWidth: 1,
    borderBottomWidth: 4
  },
  createRoomBtn: {
    backgroundColor: '#059669',
    borderColor: '#6EE7B7',
    borderBottomColor: '#065F46'
  },
  joinRoomBtn: {
    backgroundColor: '#1D4ED8',
    borderColor: '#93C5FD',
    borderBottomColor: '#1E3A8A'
  },
  subOptionPressed: {
    transform: [{ translateY: 2 }],
    borderBottomWidth: 2
  },
  subOptionDisabled: {
    opacity: 0.4
  },
  subOptionTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900'
  },
  subOptionHint: {
    color: 'rgba(255, 255, 255, 0.82)',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(6, 11, 22, 0.86)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20
  },
  joinModalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#122038',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1.5,
    borderColor: '#38BDF8'
  },
  recordsModalCard: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '82%',
    backgroundColor: '#122038',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1.5,
    borderColor: '#FBBF24'
  },
  recordsModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14
  },
  recordsCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#1E2F4D',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#334E78'
  },
  recordsCloseText: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '900'
  },
  modalKicker: {
    color: '#7DD3FC',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2
  },
  modalTitle: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: '900',
    marginTop: 2
  },
  modalSub: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 4,
    marginBottom: 14,
    fontWeight: '600'
  },
  codeInput: {
    backgroundColor: '#091220',
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 16,
    color: '#F8FAFC',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 8,
    textAlign: 'center',
    borderWidth: 1.5,
    borderColor: '#38BDF8',
    marginBottom: 12
  },
  inlineErrorBox: {
    backgroundColor: '#7F1D1D',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#EF4444'
  },
  inlineErrorText: {
    color: '#FECACA',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center'
  },
  modalActionRow: {
    flexDirection: 'row',
    gap: 10
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center'
  },
  modalCancelText: {
    color: '#CBD5E1',
    fontSize: 14,
    fontWeight: '800'
  },
  modalConfirmBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: '#0284C7',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 4,
    borderBottomColor: '#075985'
  },
  modalConfirmText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900'
  }
});
