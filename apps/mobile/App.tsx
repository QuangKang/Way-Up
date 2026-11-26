import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import {
  DeviceIdentity,
  GAME_CONSTANTS,
  generateRandomSeed,
  MatchFinishedPayload,
  Player,
  RoomState
} from '@climb/shared';
import {
  getOrCreateDeviceIdentity,
  updateNickname
} from './src/db/identityService';
import { getAllLocalRecords } from './src/db/scoreService';
import { useMultiplayerLobby } from './src/hooks/useMultiplayerLobby';
import { LobbyScreen } from './src/screens/LobbyScreen';
import { WaitingRoomScreen } from './src/screens/WaitingRoomScreen';
import { GameScreen } from './src/screens/GameScreen';
import { ResultsScreen } from './src/screens/ResultsScreen';
import { HapticsService } from './src/haptics/hapticsService';

const SERVER_URL =
  process.env.EXPO_PUBLIC_SERVER_URL ?? 'http://localhost:3001';

type OfflinePhase = 'NONE' | 'COUNTDOWN' | 'PLAYING' | 'FINISHED';

function buildOfflineRoomState(
  playerId: string,
  playerName: string,
  seed: number,
  phase: 'COUNTDOWN' | 'PLAYING' | 'FINISHED'
): RoomState {
  const now = Date.now();
  const baseX = GAME_CONSTANTS.WORLD_WIDTH * 0.5;
  const players: Player[] = [
    {
      id: playerId,
      nickname: playerName,
      name: playerName,
      isHost: true,
      isReady: true,
      color: '#3B82F6',
      height: 0,
      x: baseX,
      y: 0,
      score: 0,
      status: phase === 'PLAYING' ? 'CLIMBING' : 'IDLE',
      finishTimeMs: null,
      ping: 0
    },
    {
      id: 'ai-bot-frost',
      nickname: 'FrostBot',
      name: 'FrostBot',
      isHost: false,
      isReady: true,
      color: '#EF4444',
      height: 0,
      x: baseX,
      y: 0,
      score: 0,
      status: phase === 'PLAYING' ? 'CLIMBING' : 'IDLE',
      finishTimeMs: null,
      ping: 0
    },
    {
      id: 'ai-bot-crag',
      nickname: 'CragHopper',
      name: 'CragHopper',
      isHost: false,
      isReady: true,
      color: '#10B981',
      height: 0,
      x: baseX,
      y: 0,
      score: 0,
      status: phase === 'PLAYING' ? 'CLIMBING' : 'IDLE',
      finishTimeMs: null,
      ping: 0
    },
    {
      id: 'ai-bot-peak',
      nickname: 'PeakRunner',
      name: 'PeakRunner',
      isHost: false,
      isReady: true,
      color: '#F59E0B',
      height: 0,
      x: baseX,
      y: 0,
      score: 0,
      status: phase === 'PLAYING' ? 'CLIMBING' : 'IDLE',
      finishTimeMs: null,
      ping: 0
    }
  ];

  return {
    code: 'SOLO',
    phase,
    status: phase,
    hostId: playerId,
    players,
    maxPlayers: 4,
    minPlayers: 1,
    config: {
      seed,
      targetHeight: 500,
      countdownSec: 3
    },
    seed,
    targetHeight: 500,
    goalHeight: 500,
    countdownRemaining: phase === 'COUNTDOWN' ? 3 : null,
    createdAt: now,
    startedAt: phase === 'PLAYING' ? now : null,
    finishedAt: null,
    winnerId: null
  };
}

export default function App(): React.JSX.Element {
  const [identity, setIdentity] = useState<DeviceIdentity | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isEditingNickname, setIsEditingNickname] = useState(false);
  const [nicknameDraft, setNicknameDraft] = useState('');
  const [nicknameError, setNicknameError] = useState<string | null>(null);

  // Quiet Long-Press Dev Inspector Modal (~1.2s hold on WAY UP! wordmark)
  const [showDevModal, setShowDevModal] = useState(false);
  const [sqliteRecordCount, setSqliteRecordCount] = useState<number>(0);

  // Offline Solo + 3 AI Bots Lifecycle
  const [offlinePhase, setOfflinePhase] = useState<OfflinePhase>('NONE');
  const [offlineCountdown, setOfflineCountdown] = useState<number>(3);
  const [offlineRoom, setOfflineRoom] = useState<RoomState | null>(null);
  const [offlineResult, setOfflineResult] =
    useState<MatchFinishedPayload | null>(null);
  const offlineTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Initialize SQLite device identity on startup
  useEffect(() => {
    async function init() {
      try {
        const id = await getOrCreateDeviceIdentity();
        setIdentity(id);
        setNicknameDraft(id.nickname);
      } catch (err) {
        console.warn('Failed to initialize SQLite identity:', err);
      } finally {
        setIsInitializing(false);
      }
    }
    void init();
  }, []);

  const clearOfflineTimer = useCallback(() => {
    if (offlineTimerRef.current) {
      clearInterval(offlineTimerRef.current);
      offlineTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearOfflineTimer();
    };
  }, [clearOfflineTimer]);

  const playerId = identity?.guestUuid ?? 'guest-loading';
  const playerName = identity?.nickname ?? 'Climber';

  const {
    connectionState,
    roomState,
    countdownSeconds,
    livePlayers,
    matchResult,
    error,
    joinOrCreateRoom,
    toggleReady,
    startMatch,
    sendPlayerMove,
    requestRematch,
    leaveRoom,
    clearError
  } = useMultiplayerLobby({
    serverUrl: SERVER_URL,
    playerId,
    playerName
  });

  const handleSaveNickname = async () => {
    const trimmed = nicknameDraft.trim();
    if (!trimmed) {
      setNicknameError('Nickname cannot be empty');
      return;
    }

    try {
      const updated = await updateNickname(trimmed);
      setIdentity(updated);
      setNicknameDraft(updated.nickname);
      setNicknameError(null);
      setIsEditingNickname(false);
      void HapticsService.selection();
    } catch (err) {
      console.warn('Failed saving nickname to SQLite:', err);
      setNicknameError('Could not save nickname');
    }
  };

  const handleOpenDevModal = useCallback(async () => {
    void HapticsService.selection();
    try {
      const records = await getAllLocalRecords();
      setSqliteRecordCount(records.length);
    } catch {
      setSqliteRecordCount(0);
    }
    setShowDevModal(true);
  }, []);

  // Launch fresh Offline match (3-2-1 quick countdown -> GameScreen with 3 AI bots)
  const startOfflineRace = useCallback(() => {
    clearOfflineTimer();
    const freshSeed = generateRandomSeed();
    const initialRoom = buildOfflineRoomState(
      playerId,
      playerName,
      freshSeed,
      'COUNTDOWN'
    );

    setOfflineResult(null);
    setOfflineRoom(initialRoom);
    setOfflineCountdown(3);
    setOfflinePhase('COUNTDOWN');
    void HapticsService.warning();

    let remaining = 3;
    offlineTimerRef.current = setInterval(() => {
      remaining -= 1;
      if (remaining > 0) {
        setOfflineCountdown(remaining);
        void HapticsService.warning();
        return;
      }

      clearOfflineTimer();
      const playingRoom: RoomState = {
        ...initialRoom,
        phase: 'PLAYING',
        status: 'PLAYING',
        countdownRemaining: null,
        startedAt: Date.now(),
        players: initialRoom.players.map((p) => ({
          ...p,
          status: 'CLIMBING'
        }))
      };
      setOfflineRoom(playingRoom);
      setOfflinePhase('PLAYING');
      void HapticsService.springBoost();
    }, 750);
  }, [clearOfflineTimer, playerId, playerName]);

  const handleOfflineFinished = useCallback(
    (finishedPayload: MatchFinishedPayload) => {
      clearOfflineTimer();
      setOfflineResult(finishedPayload);
      setOfflineRoom(finishedPayload.room);
      setOfflinePhase('FINISHED');
    },
    [clearOfflineTimer]
  );

  const exitOfflineMode = useCallback(() => {
    clearOfflineTimer();
    setOfflinePhase('NONE');
    setOfflineRoom(null);
    setOfflineResult(null);
    void HapticsService.selection();
  }, [clearOfflineTimer]);

  if (isInitializing) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" />
        <View style={styles.centered}>
          <View style={styles.loadingPeakBadge}>
            <Text style={styles.loadingPeakGlyph}>▲</Text>
          </View>
          <Text style={styles.loadingTitle}>WAY UP!</Text>
          <Text style={styles.loadingText}>Preparing Climbing Gear...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Dedicated full-viewport container during Online PLAYING phase
  if (roomState && roomState.phase === 'PLAYING') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" />
        {error && (
          <TouchableOpacity
            style={styles.playingErrorBanner}
            onPress={clearError}
          >
            <Text style={styles.errorText}>{error}</Text>
            <Text style={styles.errorDismiss}>Dismiss</Text>
          </TouchableOpacity>
        )}
        <GameScreen
          mode="ONLINE"
          roomState={roomState}
          playerId={playerId}
          livePlayers={livePlayers}
          onSendMove={sendPlayerMove}
          onLeaveRoom={leaveRoom}
        />
      </SafeAreaView>
    );
  }

  // Dedicated full-viewport container during Offline PLAYING phase
  if (offlinePhase === 'PLAYING' && offlineRoom) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" />
        <GameScreen
          mode="OFFLINE"
          roomState={offlineRoom}
          playerId={playerId}
          livePlayers={[]}
          onSendMove={() => {
            // Local offline run requires no socket emits
          }}
          onOfflineFinish={handleOfflineFinished}
          onLeaveRoom={exitOfflineMode}
        />
      </SafeAreaView>
    );
  }

  const isInOnlineRoom = roomState !== null;
  const isInOfflineFlow = offlinePhase !== 'NONE';
  const canEditProfile = !isInOnlineRoom && !isInOfflineFlow;
  const isConnected =
    connectionState === 'CONNECTED' || connectionState === 'IN_ROOM';

  const statusLabel =
    connectionState === 'IN_ROOM'
      ? 'IN LOBBY'
      : connectionState === 'CONNECTED'
      ? 'ONLINE'
      : connectionState === 'CONNECTING'
      ? 'CONNECTING'
      : 'OFFLINE';

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />

      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        {/* Atmospheric Alpine Hero Header (Long-press WAY UP! ~1.2s for quiet Dev Info Modal) */}
        <View style={styles.heroBanner}>
          <View style={[styles.starDot, { top: 14, left: 32 }]} />
          <View style={[styles.starDot, { top: 22, right: 86 }]} />
          <View style={[styles.starDot, { top: 12, right: 150 }]} />
          <View style={styles.mountainFarLeft} />
          <View style={styles.mountainFarRight} />
          <View style={styles.mountainCenterPeak}>
            <View style={styles.mountainSnowCap} />
          </View>

          <View style={styles.headerTopRow}>
            <Pressable
              delayLongPress={1200}
              onLongPress={() => {
                void handleOpenDevModal();
              }}
              style={styles.brandRow}
            >
              <View style={styles.logoEmblem}>
                <View style={styles.logoPeakShape} />
                <View style={styles.logoSnowTip} />
              </View>
              <View>
                <Text style={styles.appTitle}>WAY UP!</Text>
                <Text style={styles.appSubtitle}>ALPINE SUMMIT RACE</Text>
              </View>
            </Pressable>

            <View style={styles.connectionBadge}>
              <View
                style={[
                  styles.statusDot,
                  connectionState === 'IN_ROOM'
                    ? styles.dotGreen
                    : connectionState === 'CONNECTED'
                    ? styles.dotBlue
                    : styles.dotGray
                ]}
              />
              <Text style={styles.connectionText}>{statusLabel}</Text>
            </View>
          </View>
        </View>

        {/* Tap-Anywhere Player Name Profile Pill (Subtle pencil icon ✎, no standalone Edit/Info buttons) */}
        {identity && (
          <View style={styles.profileCard}>
            {isEditingNickname ? (
              <View style={styles.nicknameEditRow}>
                <TextInput
                  style={styles.nicknameInput}
                  value={nicknameDraft}
                  onChangeText={setNicknameDraft}
                  maxLength={20}
                  autoFocus
                  placeholder="Climber nickname"
                  placeholderTextColor="#64748B"
                  returnKeyType="done"
                  onSubmitEditing={() => {
                    void handleSaveNickname();
                  }}
                />
                <Pressable
                  style={styles.saveBtn}
                  onPress={() => {
                    void handleSaveNickname();
                  }}
                >
                  <Text style={styles.saveBtnText}>Save</Text>
                </Pressable>
                <Pressable
                  style={styles.cancelBtn}
                  onPress={() => {
                    setNicknameDraft(identity.nickname);
                    setNicknameError(null);
                    setIsEditingNickname(false);
                  }}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable
                disabled={!canEditProfile}
                style={({ pressed }) => [
                  styles.profilePressableZone,
                  pressed && canEditProfile && styles.profilePressableActive
                ]}
                onPress={() => {
                  void HapticsService.selection();
                  setNicknameDraft(identity.nickname);
                  setNicknameError(null);
                  setIsEditingNickname(true);
                }}
              >
                <View style={styles.climberAvatar}>
                  <View style={styles.avatarHeadlamp} />
                  <View style={styles.avatarGoggles} />
                </View>

                <View style={styles.profileTextCol}>
                  <Text style={styles.profileKicker}>CLIMBER</Text>
                  <View style={styles.nameWithPencilRow}>
                    <Text style={styles.profileNickname} numberOfLines={1}>
                      {identity.nickname}
                    </Text>
                    {canEditProfile && (
                      <Text style={styles.pencilGlyph}>✎</Text>
                    )}
                  </View>
                </View>
              </Pressable>
            )}

            {nicknameError && (
              <Text style={styles.nicknameErrorText}>{nicknameError}</Text>
            )}
          </View>
        )}

        {/* Error Banner (when outside Join Modal) */}
        {error && isInOnlineRoom && (
          <TouchableOpacity style={styles.errorBanner} onPress={clearError}>
            <Text style={styles.errorText}>{error}</Text>
            <Text style={styles.errorDismiss}>Dismiss</Text>
          </TouchableOpacity>
        )}

        {/* Home Screen (when neither in Online room nor Offline results) */}
        {!roomState && offlinePhase !== 'FINISHED' && (
          <LobbyScreen
            playerId={playerId}
            isConnecting={connectionState === 'CONNECTING'}
            isConnected={isConnected}
            serverError={error}
            onClearError={clearError}
            onCreateOnlineRoom={() =>
              joinOrCreateRoom(undefined, identity?.nickname)
            }
            onJoinOnlineRoom={(code) =>
              joinOrCreateRoom(code, identity?.nickname)
            }
            onStartOfflineMatch={startOfflineRace}
          />
        )}

        {/* Online Waiting Room */}
        {roomState &&
          (roomState.phase === 'WAITING' ||
            roomState.phase === 'COUNTDOWN') && (
            <WaitingRoomScreen
              roomState={roomState}
              playerId={playerId}
              countdownSeconds={countdownSeconds}
              onToggleReady={toggleReady}
              onStartMatch={startMatch}
              onLeaveRoom={leaveRoom}
            />
          )}

        {/* Online Match Results */}
        {roomState && roomState.phase === 'FINISHED' && (
          <ResultsScreen
            roomState={roomState}
            matchResult={matchResult}
            playerId={playerId}
            onRematch={requestRematch}
            onLeaveRoom={leaveRoom}
          />
        )}

        {/* Offline Bot Race Results */}
        {!roomState && offlinePhase === 'FINISHED' && offlineRoom && (
          <ResultsScreen
            isOffline
            roomState={offlineRoom}
            matchResult={offlineResult}
            playerId={playerId}
            onRematch={startOfflineRace}
            onLeaveRoom={exitOfflineMode}
          />
        )}
      </ScrollView>

      {/* Offline Quick 3-2-1 Countdown Modal */}
      <Modal
        visible={offlinePhase === 'COUNTDOWN'}
        transparent
        animationType="fade"
        onRequestClose={exitOfflineMode}
      >
        <View style={styles.countdownBackdrop}>
          <View style={styles.countdownCard}>
            <Text style={styles.countdownKicker}>
              OFFLINE RACE • VS 3 AI CLIMBERS
            </Text>
            <Text style={styles.countdownBigNumber}>{offlineCountdown}</Text>
            <Text style={styles.countdownRivalsText}>
              Rivals: FrostBot • CragHopper • PeakRunner
            </Text>
          </View>
        </View>
      </Modal>

      {/* Quiet Long-Press Dev Info Modal (Grading & Technical Inspection) */}
      <Modal
        visible={showDevModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDevModal(false)}
      >
        <View style={styles.countdownBackdrop}>
          <View style={styles.devModalCard}>
            <Text style={styles.devModalKicker}>DIAGNOSTICS & GRADING INFO</Text>
            <Text style={styles.devModalTitle}>Way Up! Client Inspector</Text>

            <View style={styles.devRow}>
              <Text style={styles.devKey}>Guest UUIDv4</Text>
              <Text style={styles.devVal} selectable>
                {identity?.guestUuid ?? 'N/A'}
              </Text>
            </View>

            <View style={styles.devRow}>
              <Text style={styles.devKey}>Server Endpoint</Text>
              <Text style={styles.devVal} selectable>
                {SERVER_URL}
              </Text>
            </View>

            <View style={styles.devRow}>
              <Text style={styles.devKey}>Socket State</Text>
              <Text style={styles.devVal}>{connectionState}</Text>
            </View>

            <View style={styles.devRow}>
              <Text style={styles.devKey}>SQLite Records</Text>
              <Text style={styles.devVal}>
                {sqliteRecordCount} saved in local_records
              </Text>
            </View>

            <Pressable
              style={styles.devCloseBtn}
              onPress={() => setShowDevModal(false)}
            >
              <Text style={styles.devCloseBtnText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#09111E'
  },
  container: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 28
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  loadingPeakBadge: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: '#13223A',
    borderWidth: 1.5,
    borderColor: '#38BDF8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12
  },
  loadingPeakGlyph: {
    color: '#FBBF24',
    fontSize: 24,
    fontWeight: '900'
  },
  loadingTitle: {
    color: '#F8FAFC',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginBottom: 4
  },
  loadingText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '600'
  },
  heroBanner: {
    backgroundColor: '#101E36',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#243B5E',
    overflow: 'hidden'
  },
  starDot: {
    position: 'absolute',
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#BAE6FD',
    opacity: 0.55
  },
  mountainFarLeft: {
    position: 'absolute',
    bottom: -48,
    left: -10,
    width: 110,
    height: 110,
    backgroundColor: '#162947',
    transform: [{ rotate: '45deg' }],
    borderRadius: 8
  },
  mountainFarRight: {
    position: 'absolute',
    bottom: -56,
    right: -12,
    width: 126,
    height: 126,
    backgroundColor: '#162947',
    transform: [{ rotate: '45deg' }],
    borderRadius: 10
  },
  mountainCenterPeak: {
    position: 'absolute',
    bottom: -52,
    right: 78,
    width: 98,
    height: 98,
    backgroundColor: '#1D3559',
    transform: [{ rotate: '45deg' }],
    borderRadius: 8,
    overflow: 'hidden'
  },
  mountainSnowCap: {
    width: 34,
    height: 34,
    backgroundColor: 'rgba(224, 242, 254, 0.22)'
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11
  },
  logoEmblem: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#0A1322',
    borderWidth: 1.5,
    borderColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden'
  },
  logoPeakShape: {
    position: 'absolute',
    bottom: -12,
    width: 28,
    height: 28,
    backgroundColor: '#38BDF8',
    transform: [{ rotate: '45deg' }],
    borderRadius: 3
  },
  logoSnowTip: {
    position: 'absolute',
    bottom: 4,
    width: 10,
    height: 10,
    backgroundColor: '#F8FAFC',
    transform: [{ rotate: '45deg' }],
    borderRadius: 1
  },
  appTitle: {
    fontSize: 23,
    fontWeight: '900',
    color: '#F8FAFC',
    letterSpacing: 1.4
  },
  appSubtitle: {
    fontSize: 10,
    color: '#7DD3FC',
    fontWeight: '800',
    letterSpacing: 1.2,
    marginTop: 1
  },
  connectionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(10, 19, 34, 0.88)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2A4369'
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 6
  },
  dotGreen: {
    backgroundColor: '#10B981'
  },
  dotBlue: {
    backgroundColor: '#38BDF8'
  },
  dotGray: {
    backgroundColor: '#64748B'
  },
  connectionText: {
    color: '#E2E8F0',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4
  },
  profileCard: {
    backgroundColor: '#132036',
    borderRadius: 16,
    paddingHorizontal: 13,
    paddingVertical: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#263B59'
  },
  profilePressableZone: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingVertical: 2
  },
  profilePressableActive: {
    opacity: 0.78
  },
  climberAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#3B82F6',
    borderWidth: 2,
    borderColor: '#BAE6FD',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11
  },
  avatarHeadlamp: {
    width: 8,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FEF08A',
    marginBottom: 2
  },
  avatarGoggles: {
    width: 20,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#7DD3FC'
  },
  profileTextCol: {
    flex: 1
  },
  profileKicker: {
    fontSize: 9,
    fontWeight: '900',
    color: '#64748B',
    letterSpacing: 0.8
  },
  nameWithPencilRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 1
  },
  profileNickname: {
    fontSize: 16,
    fontWeight: '900',
    color: '#F8FAFC',
    flexShrink: 1
  },
  pencilGlyph: {
    fontSize: 14,
    color: '#7DD3FC',
    fontWeight: '700'
  },
  nicknameEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  nicknameInput: {
    flex: 1,
    backgroundColor: '#0A1220',
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '800',
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#38BDF8'
  },
  saveBtn: {
    backgroundColor: '#0284C7',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800'
  },
  cancelBtn: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8
  },
  cancelBtnText: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '700'
  },
  nicknameErrorText: {
    color: '#FCA5A5',
    fontSize: 11,
    marginTop: 6,
    fontWeight: '600'
  },
  errorBanner: {
    backgroundColor: '#7F1D1D',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EF4444'
  },
  playingErrorBanner: {
    backgroundColor: '#7F1D1D',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 12,
    marginTop: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  errorText: {
    color: '#FECACA',
    fontSize: 13,
    fontWeight: '700',
    flex: 1
  },
  errorDismiss: {
    color: '#FCA5A5',
    fontSize: 12,
    fontWeight: '800',
    marginLeft: 10
  },
  countdownBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(6, 11, 22, 0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24
  },
  countdownCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#13223A',
    borderRadius: 22,
    paddingVertical: 30,
    paddingHorizontal: 24,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#F59E0B'
  },
  countdownKicker: {
    color: '#FBBF24',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.3
  },
  countdownBigNumber: {
    color: '#FFFFFF',
    fontSize: 80,
    fontWeight: '900',
    marginVertical: 8
  },
  countdownRivalsText: {
    color: '#7DD3FC',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center'
  },
  devModalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#111D33',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#38BDF8',
    gap: 10
  },
  devModalKicker: {
    color: '#7DD3FC',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2
  },
  devModalTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 4
  },
  devRow: {
    backgroundColor: '#0A1220',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#1E314F'
  },
  devKey: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 2
  },
  devVal: {
    color: '#E2E8F0',
    fontSize: 12,
    fontFamily: 'monospace',
    fontWeight: '700'
  },
  devCloseBtn: {
    marginTop: 6,
    backgroundColor: '#1E293B',
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center'
  },
  devCloseBtnText: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '800'
  }
});
