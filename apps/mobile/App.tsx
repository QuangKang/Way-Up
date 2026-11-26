import React, { useEffect, useState } from 'react';
import {
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

export default function App(): React.JSX.Element {
  const [identity, setIdentity] = useState<DeviceIdentity | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isEditingNickname, setIsEditingNickname] = useState(false);
  const [nicknameDraft, setNicknameDraft] = useState('');
  const [nicknameError, setNicknameError] = useState<string | null>(null);

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
    serverUrl: process.env.EXPO_PUBLIC_SERVER_URL ?? 'http://localhost:3001',
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
          <Text style={styles.loadingText}>
            Initializing SQLite & Device Identity...
          </Text>
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />

      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        {/* App Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.appTitle}>WAY UP!</Text>
            <Text style={styles.appSubtitle}>4-Player Real-Time Climbing</Text>
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
            <Text style={styles.connectionText}>{connectionState}</Text>
          </View>
        </View>

        {/* Guest Device Identity & Editable Nickname Card (SQLite-persisted) */}
        {identity && (
          <View style={styles.identityCard}>
            <View style={styles.identityRow}>
              <Text style={styles.identityLabel}>GUEST UUIDv4:</Text>
              <Text style={styles.identityValue} numberOfLines={1}>
                {identity.guestUuid}
              </Text>
            </View>

            <View style={styles.nicknameSection}>
              <Text style={styles.identityLabel}>NICKNAME:</Text>
              {isEditingNickname ? (
                <View style={styles.nicknameEditRow}>
                  <TextInput
                    style={styles.nicknameInput}
                    value={nicknameDraft}
                    onChangeText={setNicknameDraft}
                    maxLength={20}
                    autoFocus
                    placeholder="Enter nickname"
                    placeholderTextColor="#64748B"
                    returnKeyType="done"
                    onSubmitEditing={() => {
                      void handleSaveNickname();
                    }}
                  />
                  <TouchableOpacity
                    style={styles.saveBtn}
                    onPress={() => {
                      void handleSaveNickname();
                    }}
                  >
                    <Text style={styles.saveBtnText}>Save</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.cancelBtn}
                    onPress={() => {
                      setNicknameDraft(identity.nickname);
                      setNicknameError(null);
                      setIsEditingNickname(false);
                    }}
                  >
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.nicknameDisplayRow}>
                  <Text style={styles.identityNickname}>
                    {identity.nickname}
                  </Text>
                  {!isInRoom && (
                    <TouchableOpacity
                      style={styles.editNicknameBtn}
                      onPress={() => {
                        void HapticsService.selection();
                        setNicknameDraft(identity.nickname);
                        setIsEditingNickname(true);
                      }}
                    >
                      <Text style={styles.editNicknameText}>Edit</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>

            {nicknameError && (
              <Text style={styles.nicknameErrorText}>{nicknameError}</Text>
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
    backgroundColor: '#0F172A'
  },
  container: {
    padding: 20
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  loadingText: {
    color: '#94A3B8',
    fontSize: 16,
    fontWeight: '600'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16
  },
  appTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#F8FAFC',
    letterSpacing: 1
  },
  appSubtitle: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500'
  },
  connectionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#334155'
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6
  },
  dotGreen: {
    backgroundColor: '#10B981'
  },
  dotBlue: {
    backgroundColor: '#3B82F6'
  },
  dotGray: {
    backgroundColor: '#64748B'
  },
  connectionText: {
    color: '#CBD5E1',
    fontSize: 10,
    fontWeight: '700'
  },
  identityCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#38BDF8'
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8
  },
  nicknameSection: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  identityLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    width: 96
  },
  identityValue: {
    flex: 1,
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#38BDF8'
  },
  nicknameDisplayRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  identityNickname: {
    fontSize: 14,
    fontWeight: '800',
    color: '#F8FAFC'
  },
  editNicknameBtn: {
    backgroundColor: '#334155',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6
  },
  editNicknameText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '700'
  },
  nicknameEditRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  nicknameInput: {
    flex: 1,
    backgroundColor: '#0F172A',
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#38BDF8'
  },
  saveBtn: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800'
  },
  cancelBtn: {
    backgroundColor: '#334155',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6
  },
  cancelBtnText: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '700'
  },
  nicknameErrorText: {
    color: '#FCA5A5',
    fontSize: 11,
    marginTop: 6
  },
  errorBanner: {
    backgroundColor: '#7F1D1D',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
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
    fontWeight: '600',
    flex: 1
  },
  errorDismiss: {
    color: '#FCA5A5',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 10
  }
});
