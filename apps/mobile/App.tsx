import React, { useEffect, useState } from 'react';
import {
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
import { DeviceIdentity } from '@climb/shared';
import {
  getOrCreateDeviceIdentity,
  updateNickname
} from './src/db/identityService';
import { useMultiplayerLobby } from './src/hooks/useMultiplayerLobby';
import { LobbyScreen } from './src/screens/LobbyScreen';
import { WaitingRoomScreen } from './src/screens/WaitingRoomScreen';
import { GameScreen } from './src/screens/GameScreen';
import { ResultsScreen } from './src/screens/ResultsScreen';
import { HapticsService } from './src/haptics/hapticsService';

const SERVER_URL =
  process.env.EXPO_PUBLIC_SERVER_URL ?? 'http://localhost:3001';

export default function App(): React.JSX.Element {
  const [identity, setIdentity] = useState<DeviceIdentity | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isEditingNickname, setIsEditingNickname] = useState(false);
  const [nicknameDraft, setNicknameDraft] = useState('');
  const [nicknameError, setNicknameError] = useState<string | null>(null);
  const [showProfileInfo, setShowProfileInfo] = useState(false);

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

  const playerId = identity?.guestUuid ?? 'guest-loading';
  const playerName = identity?.nickname ?? 'Climber';

  const {
    connectionState,
    roomState,
    countdownSeconds,
    matchStartPayload,
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

  if (isInitializing) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" />
        <View style={styles.centered}>
          <View style={styles.loadingPeakBadge}>
            <Text style={styles.loadingPeakGlyph}>▲</Text>
          </View>
          <Text style={styles.loadingTitle}>WAY UP!</Text>
          <Text style={styles.loadingText}>Preparing Basecamp Gear...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Dedicated full-viewport container during active gameplay so ScrollView never steals multi-touch controls
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
          roomState={roomState}
          playerId={playerId}
          livePlayers={livePlayers}
          onSendMove={sendPlayerMove}
          onLeaveRoom={leaveRoom}
        />
      </SafeAreaView>
    );
  }

  const isInRoom = roomState !== null;
  const isConnected =
    connectionState === 'CONNECTED' || connectionState === 'IN_ROOM';

  const statusLabel =
    connectionState === 'IN_ROOM'
      ? 'IN EXPEDITION'
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
        {/* Atmospheric Alpine Hero Header */}
        <View style={styles.heroBanner}>
          {/* Pure-RN Star Dots & Layered Mountain Silhouettes */}
          <View style={[styles.starDot, { top: 14, left: 32 }]} />
          <View style={[styles.starDot, { top: 22, right: 86 }]} />
          <View style={[styles.starDot, { top: 12, right: 150 }]} />
          <View style={styles.mountainFarLeft} />
          <View style={styles.mountainFarRight} />
          <View style={styles.mountainCenterPeak}>
            <View style={styles.mountainSnowCap} />
          </View>

          <View style={styles.headerTopRow}>
            <View style={styles.brandRow}>
              <View style={styles.logoEmblem}>
                <View style={styles.logoPeakShape} />
                <View style={styles.logoSnowTip} />
              </View>
              <View>
                <Text style={styles.appTitle}>WAY UP!</Text>
                <Text style={styles.appSubtitle}>ALPINE SUMMIT RACE</Text>
              </View>
            </View>

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

        {/* Climber Profile Pill (replaces raw UUIDv4 dev banner; Info toggle reveals Guest ID) */}
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
              <View style={styles.profileRow}>
                {/* Pure-RN Mini Climber Helmet & Goggles Avatar */}
                <View style={styles.climberAvatar}>
                  <View style={styles.avatarHeadlamp} />
                  <View style={styles.avatarGoggles} />
                </View>

                <View style={styles.profileTextCol}>
                  <Text style={styles.profileKicker}>CLIMBER PROFILE</Text>
                  <Text style={styles.profileNickname} numberOfLines={1}>
                    {identity.nickname}
                  </Text>
                </View>

                <View style={styles.profileActions}>
                  {!isInRoom && (
                    <Pressable
                      style={styles.editNicknameBtn}
                      onPress={() => {
                        void HapticsService.selection();
                        setNicknameDraft(identity.nickname);
                        setIsEditingNickname(true);
                      }}
                    >
                      <Text style={styles.editNicknameText}>Edit</Text>
                    </Pressable>
                  )}

                  <Pressable
                    style={[
                      styles.infoToggleBtn,
                      showProfileInfo && styles.infoToggleBtnActive
                    ]}
                    onPress={() => {
                      void HapticsService.selection();
                      setShowProfileInfo((prev) => !prev);
                    }}
                  >
                    <Text
                      style={[
                        styles.infoToggleText,
                        showProfileInfo && styles.infoToggleTextActive
                      ]}
                    >
                      Info
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}

            {nicknameError && (
              <Text style={styles.nicknameErrorText}>{nicknameError}</Text>
            )}

            {showProfileInfo && (
              <View style={styles.devDrawer}>
                <View style={styles.devInfoRow}>
                  <Text style={styles.devInfoLabel}>GUEST ID (UUIDv4):</Text>
                  <Text style={styles.devInfoMono} numberOfLines={1}>
                    {identity.guestUuid}
                  </Text>
                </View>
                <View style={styles.devInfoRow}>
                  <Text style={styles.devInfoLabel}>SERVER:</Text>
                  <Text style={styles.devInfoMono} numberOfLines={1}>
                    {SERVER_URL} ({connectionState})
                  </Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Error Banner */}
        {error && (
          <TouchableOpacity style={styles.errorBanner} onPress={clearError}>
            <Text style={styles.errorText}>{error}</Text>
            <Text style={styles.errorDismiss}>Dismiss</Text>
          </TouchableOpacity>
        )}

        {/* Phase-Driven Screen Router */}
        {!roomState && (
          <LobbyScreen
            playerId={playerId}
            isConnecting={connectionState === 'CONNECTING'}
            isConnected={isConnected}
            previewSeed={matchStartPayload?.seed ?? 424242}
            onJoinOrCreateRoom={(code) =>
              joinOrCreateRoom(code, identity?.nickname)
            }
          />
        )}

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

        {roomState && roomState.phase === 'FINISHED' && (
          <ResultsScreen
            roomState={roomState}
            matchResult={matchResult}
            playerId={playerId}
            onRematch={requestRematch}
            onLeaveRoom={leaveRoom}
          />
        )}
      </ScrollView>
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
    borderRadius: 15,
    paddingHorizontal: 13,
    paddingVertical: 11,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#263B59'
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  climberAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EA580C',
    borderWidth: 2,
    borderColor: '#FDBA74',
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
    borderColor: '#38BDF8'
  },
  profileTextCol: {
    flex: 1,
    marginRight: 8
  },
  profileKicker: {
    fontSize: 9,
    fontWeight: '900',
    color: '#64748B',
    letterSpacing: 0.8
  },
  profileNickname: {
    fontSize: 15,
    fontWeight: '900',
    color: '#F8FAFC',
    marginTop: 1
  },
  profileActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  editNicknameBtn: {
    backgroundColor: '#1E3A5F',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#38BDF8'
  },
  editNicknameText: {
    color: '#BAE6FD',
    fontSize: 11,
    fontWeight: '800'
  },
  infoToggleBtn: {
    backgroundColor: '#0B1424',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#263B59'
  },
  infoToggleBtnActive: {
    borderColor: '#7DD3FC',
    backgroundColor: '#10243E'
  },
  infoToggleText: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '800'
  },
  infoToggleTextActive: {
    color: '#7DD3FC'
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
  devDrawer: {
    marginTop: 10,
    paddingTop: 9,
    borderTopWidth: 1,
    borderTopColor: '#1E314D',
    gap: 4
  },
  devInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  devInfoLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748B',
    width: 102
  },
  devInfoMono: {
    flex: 1,
    fontSize: 10,
    fontFamily: 'monospace',
    color: '#7DD3FC'
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
  }
});
