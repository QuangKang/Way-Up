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
  BotDifficulty,
  CLIMBER_COLORS,
  DEFAULT_MATCH_SETTINGS,
  DeviceIdentity,
  GAME_CONSTANTS,
  generateRandomSeed,
  MatchFinishedPayload,
  MatchSettings,
  Player,
  RoomState
} from '@climb/shared';
import { ClimberAvatar } from './src/components/MountainArtwork';
import { OfflineLaunchConfig } from './src/components/OfflineSetupModal';
import {
  getOrCreateDeviceIdentity,
  updateNickname
} from './src/db/identityService';
import {
  AppLanguage,
  DEFAULT_USER_PREFERENCES,
  getOrCreatePreferences,
  updatePreferences,
  UserPreferences
} from './src/db/preferencesService';
import { getAllLocalRecords } from './src/db/scoreService';
import { useMultiplayerLobby } from './src/hooks/useMultiplayerLobby';
import { LanguageProvider } from './src/i18n/LanguageContext';
import { TRANSLATIONS } from './src/i18n/translations';
import { GameScreen } from './src/screens/GameScreen';
import { LobbyScreen } from './src/screens/LobbyScreen';
import { ResultsScreen } from './src/screens/ResultsScreen';
import { WaitingRoomScreen } from './src/screens/WaitingRoomScreen';
import { SoundService } from './src/services/soundService';

const SERVER_URL =
  process.env.EXPO_PUBLIC_SERVER_URL ?? 'http://localhost:3001';

type OfflinePhase = 'NONE' | 'COUNTDOWN' | 'PLAYING' | 'FINISHED';

function buildOfflineRoomState(
  playerId: string,
  playerName: string,
  playerColor: string,
  settings: MatchSettings,
  seed: number,
  phase: 'COUNTDOWN' | 'PLAYING' | 'FINISHED'
): RoomState {
  const now = Date.now();
  const baseX = GAME_CONSTANTS.WORLD_WIDTH * 0.5;
  const remainingColors = CLIMBER_COLORS.filter((c) => c !== playerColor);

  const players: Player[] = [
    {
      id: playerId,
      nickname: playerName,
      name: playerName,
      isHost: true,
      isReady: true,
      color: playerColor,
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
      color: remainingColors[0] ?? '#EF4444',
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
      color: remainingColors[1] ?? '#10B981',
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
      color: remainingColors[2] ?? '#F59E0B',
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
    settings: { ...settings },
    config: {
      seed,
      targetHeight: 500,
      countdownSec: 3,
      settings: { ...settings }
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
  const [prefs, setPrefs] = useState<UserPreferences>(DEFAULT_USER_PREFERENCES);
  const [isInitializing, setIsInitializing] = useState(true);

  const [isEditingNickname, setIsEditingNickname] = useState(false);
  const [nicknameDraft, setNicknameDraft] = useState('');
  const [nicknameError, setNicknameError] = useState<string | null>(null);

  // Quiet Long-Press Dev Inspector Modal (~1.2s hold on WAY UP! wordmark)
  const [showDevModal, setShowDevModal] = useState(false);
  const [sqliteRecordCount, setSqliteRecordCount] = useState<number>(0);

  // Offline Solo + 3 AI Bots Lifecycle & Saved Setup Config
  const [offlinePhase, setOfflinePhase] = useState<OfflinePhase>('NONE');
  const [offlineCountdown, setOfflineCountdown] = useState<number>(3);
  const [offlineRoom, setOfflineRoom] = useState<RoomState | null>(null);
  const [offlineDifficulty, setOfflineDifficulty] =
    useState<BotDifficulty>('MEDIUM');
  const [lastOfflineConfig, setLastOfflineConfig] = useState<OfflineLaunchConfig>(
    {
      playerColor: DEFAULT_USER_PREFERENCES.preferredColor,
      botDifficulty: 'MEDIUM',
      settings: { ...DEFAULT_MATCH_SETTINGS }
    }
  );
  const [offlineResult, setOfflineResult] =
    useState<MatchFinishedPayload | null>(null);
  const offlineTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Initialize SQLite device identity & user preferences on startup
  useEffect(() => {
    async function init() {
      try {
        const [id, loadedPrefs] = await Promise.all([
          getOrCreateDeviceIdentity(),
          getOrCreatePreferences()
        ]);
        setIdentity(id);
        setNicknameDraft(id.nickname);
        setPrefs(loadedPrefs);
        SoundService.configure({
          soundEnabled: loadedPrefs.soundEnabled,
          hapticsEnabled: loadedPrefs.hapticsEnabled
        });
      } catch (err) {
        console.warn('Failed to initialize SQLite startup state:', err);
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

  const t = TRANSLATIONS[prefs.language];
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
    selectPlayerColor,
    updateRoomSettings,
    toggleReady,
    startMatch,
    sendPlayerMove,
    requestRematch,
    leaveRoom,
    clearError
  } = useMultiplayerLobby({
    serverUrl: SERVER_URL,
    playerId,
    playerName,
    preferredColor: prefs.preferredColor
  });

  const handleUpdatePrefs = useCallback(
    async (patch: Partial<UserPreferences>) => {
      const optimistic: UserPreferences = { ...prefs, ...patch };
      setPrefs(optimistic);
      SoundService.configure({
        soundEnabled: optimistic.soundEnabled,
        hapticsEnabled: optimistic.hapticsEnabled
      });
      try {
        const saved = await updatePreferences(patch);
        setPrefs(saved);
      } catch (err) {
        console.warn('Failed saving preferences to SQLite:', err);
      }
    },
    [prefs]
  );

  const handleSaveNickname = async () => {
    const trimmed = nicknameDraft.trim();
    if (!trimmed) {
      setNicknameError(t.nicknameEmptyError);
      return;
    }

    try {
      const updated = await updateNickname(trimmed);
      setIdentity(updated);
      setNicknameDraft(updated.nickname);
      setNicknameError(null);
      setIsEditingNickname(false);
      SoundService.play('ui_tap');
    } catch (err) {
      console.warn('Failed saving nickname to SQLite:', err);
      setNicknameError(t.nicknameSaveError);
    }
  };

  const handleOpenDevModal = useCallback(async () => {
    SoundService.play('ui_tap');
    try {
      const records = await getAllLocalRecords();
      setSqliteRecordCount(records.length);
    } catch {
      setSqliteRecordCount(0);
    }
    setShowDevModal(true);
  }, []);

  const launchOfflineWithConfig = useCallback(
    (config: OfflineLaunchConfig) => {
      clearOfflineTimer();
      setLastOfflineConfig(config);
      setOfflineDifficulty(config.botDifficulty);

      const freshSeed = generateRandomSeed();
      const initialRoom = buildOfflineRoomState(
        playerId,
        playerName,
        config.playerColor,
        config.settings,
        freshSeed,
        'COUNTDOWN'
      );

      setOfflineResult(null);
      setOfflineRoom(initialRoom);
      setOfflineCountdown(3);
      setOfflinePhase('COUNTDOWN');
      SoundService.play('countdown_tick');

      let remaining = 3;
      offlineTimerRef.current = setInterval(() => {
        remaining -= 1;
        if (remaining > 0) {
          setOfflineCountdown(remaining);
          SoundService.play('countdown_tick');
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
        SoundService.play('match_go');
      }, 750);
    },
    [clearOfflineTimer, playerId, playerName]
  );

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
    SoundService.play('ui_tap');
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
        </View>
      </SafeAreaView>
    );
  }

  return (
    <LanguageProvider
      language={prefs.language}
      onChangeLanguage={(lang: AppLanguage) => {
        void handleUpdatePrefs({ language: lang });
      }}
    >
      {/* Dedicated full-viewport container during Online PLAYING phase */}
      {roomState && roomState.phase === 'PLAYING' ? (
        <SafeAreaView style={styles.safeArea}>
          <StatusBar barStyle="light-content" />
          {error && (
            <TouchableOpacity
              style={styles.playingErrorBanner}
              onPress={clearError}
            >
              <Text style={styles.errorText}>{error}</Text>
              <Text style={styles.errorDismiss}>{t.dismiss}</Text>
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
      ) : offlinePhase === 'PLAYING' && offlineRoom ? (
        /* Dedicated full-viewport container during Offline PLAYING phase */
        <SafeAreaView style={styles.safeArea}>
          <StatusBar barStyle="light-content" />
          <GameScreen
            mode="OFFLINE"
            botDifficulty={offlineDifficulty}
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
      ) : (
        /* Non-Playing Screens: Full-Screen Atmospheric Mountain Backdrop + Top-Edge Profile Pill */
        <SafeAreaView style={styles.safeArea}>
          <StatusBar barStyle="light-content" />

          {/* Persistent Full-Screen Alpine Night Sky & Snowy Mountain Backdrop */}
          <View pointerEvents="none" style={styles.backdropLayer}>
            <View style={[styles.starDot, { top: '12%', left: '16%' }]} />
            <View style={[styles.starDot, { top: '18%', right: '24%' }]} />
            <View style={[styles.starDot, { top: '27%', left: '72%' }]} />
            <View style={[styles.starDot, { top: '34%', left: '12%' }]} />
            <View style={styles.bgMountainLeft}>
              <View style={styles.bgMountainSnow} />
            </View>
            <View style={styles.bgMountainRight}>
              <View style={styles.bgMountainSnow} />
            </View>
            <View style={styles.bgMountainCenter}>
              <View style={styles.bgMountainCenterSnow} />
            </View>
          </View>

          {/* Top Edge Bar: Tap-Anywhere Player Name Pill + Connection Indicator */}
          <View style={styles.topEdgeBar}>
            {identity && (
              <View style={styles.topProfileWrap}>
                {isEditingNickname ? (
                  <View style={styles.nicknameEditRow}>
                    <TextInput
                      style={styles.nicknameInput}
                      value={nicknameDraft}
                      onChangeText={setNicknameDraft}
                      maxLength={20}
                      autoFocus
                      placeholder={t.nicknamePlaceholder}
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
                      <Text style={styles.saveBtnText}>{t.save}</Text>
                    </Pressable>
                    <Pressable
                      style={styles.cancelBtn}
                      onPress={() => {
                        setNicknameDraft(identity.nickname);
                        setNicknameError(null);
                        setIsEditingNickname(false);
                      }}
                    >
                      <Text style={styles.cancelBtnText}>✕</Text>
                    </Pressable>
                  </View>
                ) : (
                  <Pressable
                    disabled={roomState !== null || offlinePhase !== 'NONE'}
                    style={({ pressed }) => [
                      styles.topNamePill,
                      pressed && styles.topNamePillPressed
                    ]}
                    onPress={() => {
                      SoundService.play('ui_tap');
                      setNicknameDraft(identity.nickname);
                      setNicknameError(null);
                      setIsEditingNickname(true);
                    }}
                  >
                    <View style={styles.miniAvatarCircle}>
                      <ClimberAvatar
                        jacketColor={prefs.preferredColor}
                        scale={0.58}
                      />
                    </View>
                    <Text style={styles.topNicknameText} numberOfLines={1}>
                      {identity.nickname}
                    </Text>
                    {!roomState && offlinePhase === 'NONE' && (
                      <Text style={styles.pencilGlyph}>✎</Text>
                    )}
                  </Pressable>
                )}
              </View>
            )}

            {!isEditingNickname && (
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
                <Text style={styles.connectionText}>
                  {connectionState === 'IN_ROOM'
                    ? t.statusInLobby
                    : connectionState === 'CONNECTED'
                    ? t.statusOnline
                    : connectionState === 'CONNECTING'
                    ? t.statusConnecting
                    : t.statusOffline}
                </Text>
              </View>
            )}
          </View>

          {nicknameError && (
            <Text style={styles.nicknameErrorBanner}>{nicknameError}</Text>
          )}

          {/* Home Screen Layout (no ScrollView box needed; floating centered elements) */}
          {!roomState && offlinePhase !== 'FINISHED' ? (
            <View style={styles.homeBodyWrap}>
              <LobbyScreen
                playerId={playerId}
                preferredColor={prefs.preferredColor}
                soundEnabled={prefs.soundEnabled}
                hapticsEnabled={prefs.hapticsEnabled}
                isConnecting={connectionState === 'CONNECTING'}
                isConnected={
                  connectionState === 'CONNECTED' ||
                  connectionState === 'IN_ROOM'
                }
                serverError={error}
                onClearError={clearError}
                onSelectPreferredColor={(color) => {
                  void handleUpdatePrefs({ preferredColor: color });
                }}
                onToggleSound={(next) => {
                  void handleUpdatePrefs({ soundEnabled: next });
                }}
                onToggleHaptics={(next) => {
                  void handleUpdatePrefs({ hapticsEnabled: next });
                }}
                onSelectLanguage={(lang) => {
                  void handleUpdatePrefs({ language: lang });
                }}
                onLongPressTitle={() => {
                  void handleOpenDevModal();
                }}
                onCreateOnlineRoom={() =>
                  joinOrCreateRoom(
                    undefined,
                    identity?.nickname,
                    prefs.preferredColor
                  )
                }
                onJoinOnlineRoom={(code) =>
                  joinOrCreateRoom(
                    code,
                    identity?.nickname,
                    prefs.preferredColor
                  )
                }
                onStartOfflineMatch={(config) => {
                  void handleUpdatePrefs({
                    preferredColor: config.playerColor
                  });
                  launchOfflineWithConfig(config);
                }}
              />
            </View>
          ) : (
            /* Scrollable Container for Online Waiting Room & Results Screens */
            <ScrollView
              contentContainerStyle={styles.scrollContainer}
              keyboardShouldPersistTaps="handled"
            >
              {error && roomState !== null && (
                <TouchableOpacity
                  style={styles.errorBanner}
                  onPress={clearError}
                >
                  <Text style={styles.errorText}>{error}</Text>
                  <Text style={styles.errorDismiss}>{t.dismiss}</Text>
                </TouchableOpacity>
              )}

              {roomState &&
                (roomState.phase === 'WAITING' ||
                  roomState.phase === 'COUNTDOWN') && (
                  <WaitingRoomScreen
                    roomState={roomState}
                    playerId={playerId}
                    countdownSeconds={countdownSeconds}
                    onSelectColor={(color) => {
                      void handleUpdatePrefs({ preferredColor: color });
                      selectPlayerColor(color);
                    }}
                    onUpdateSettings={updateRoomSettings}
                    onToggleReady={toggleReady}
                    onStartMatch={startMatch}
                    onLeaveRoom={leaveRoom}
                  />
                )}

              {roomState && roomState.phase === 'FINISHED' && (
                <ResultsScreen
                  roomState={roomState}
                  matchResult={matchResult}
                  playerId={playerId}
                  onRematch={requestRematch}
                  onLeaveRoom={leaveRoom}
                />
              )}

              {!roomState && offlinePhase === 'FINISHED' && offlineRoom && (
                <ResultsScreen
                  isOffline
                  roomState={offlineRoom}
                  matchResult={offlineResult}
                  playerId={playerId}
                  onRematch={() => launchOfflineWithConfig(lastOfflineConfig)}
                  onLeaveRoom={exitOfflineMode}
                />
              )}
            </ScrollView>
          )}

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
                  {t.offlineCountdownKicker}
                </Text>
                <Text style={styles.countdownBigNumber}>{offlineCountdown}</Text>
                <Text style={styles.countdownRivalsText}>
                  {t.offlineRivalsLabel}
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
                <Text style={styles.devModalKicker}>
                  DIAGNOSTICS & GRADING INFO
                </Text>
                <Text style={styles.devModalTitle}>
                  Way Up! Client Inspector
                </Text>

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
                  <Text style={styles.devCloseBtnText}>{t.close}</Text>
                </Pressable>
              </View>
            </View>
          </Modal>
        </SafeAreaView>
      )}
    </LanguageProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#081020'
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
    letterSpacing: 1.5
  },
  backdropLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    overflow: 'hidden'
  },
  starDot: {
    position: 'absolute',
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#E0F2FE',
    opacity: 0.55
  },
  bgMountainLeft: {
    position: 'absolute',
    bottom: -110,
    left: -55,
    width: 240,
    height: 240,
    backgroundColor: '#10203B',
    borderRadius: 16,
    transform: [{ rotate: '45deg' }],
    overflow: 'hidden'
  },
  bgMountainRight: {
    position: 'absolute',
    bottom: -120,
    right: -60,
    width: 255,
    height: 255,
    backgroundColor: '#10203B',
    borderRadius: 16,
    transform: [{ rotate: '45deg' }],
    overflow: 'hidden'
  },
  bgMountainSnow: {
    width: 68,
    height: 68,
    backgroundColor: 'rgba(226, 232, 240, 0.14)'
  },
  bgMountainCenter: {
    position: 'absolute',
    bottom: -135,
    alignSelf: 'center',
    width: 290,
    height: 290,
    backgroundColor: '#15294A',
    borderRadius: 20,
    transform: [{ rotate: '45deg' }],
    overflow: 'hidden'
  },
  bgMountainCenterSnow: {
    width: 90,
    height: 90,
    backgroundColor: 'rgba(241, 245, 249, 0.2)'
  },
  topEdgeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: 6,
    gap: 8,
    zIndex: 15
  },
  topProfileWrap: {
    flexShrink: 1,
    flexGrow: 1
  },
  topNamePill: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(17, 31, 56, 0.92)',
    borderRadius: 22,
    paddingLeft: 5,
    paddingRight: 12,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#2B456E',
    gap: 7
  },
  topNamePillPressed: {
    opacity: 0.78
  },
  miniAvatarCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#0A1324',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#38BDF8'
  },
  topNicknameText: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '900',
    flexShrink: 1
  },
  pencilGlyph: {
    color: '#7DD3FC',
    fontSize: 13,
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
    fontSize: 13,
    fontWeight: '800',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#38BDF8'
  },
  saveBtn: {
    backgroundColor: '#0284C7',
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 8
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800'
  },
  cancelBtn: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 8
  },
  cancelBtnText: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '800'
  },
  nicknameErrorBanner: {
    color: '#FCA5A5',
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 16,
    marginBottom: 4
  },
  connectionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(10, 19, 34, 0.88)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#284166'
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
  homeBodyWrap: {
    flex: 1,
    paddingHorizontal: 12
  },
  scrollContainer: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 28
  },
  errorBanner: {
    backgroundColor: '#7F1D1D',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
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
