import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { DeviceIdentity } from '@climb/shared';
import { getOrCreateDeviceIdentity } from './src/db/identityService';
import { useMultiplayerLobby } from './src/hooks/useMultiplayerLobby';
import { LobbyView } from './src/components/LobbyView';
import { OfflineRecordsView } from './src/components/OfflineRecordsView';
import { DeterministicObstaclesView } from './src/components/DeterministicObstaclesView';
import { HapticsService } from './src/haptics/hapticsService';

type ActiveTab = 'LOBBY' | 'OBSTACLES' | 'OFFLINE_RECORDS';

export default function App(): React.JSX.Element {
  const [identity, setIdentity] = useState<DeviceIdentity | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('LOBBY');
  const [isInitializing, setIsInitializing] = useState(true);

  // Initialize SQLite device identity on startup
  useEffect(() => {
    async function init() {
      try {
        const id = await getOrCreateDeviceIdentity();
        setIdentity(id);
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
    matchStartPayload,
    error,
    joinOrCreateRoom,
    toggleReady,
    startMatch,
    leaveRoom,
    clearError
  } = useMultiplayerLobby({
    serverUrl: 'http://localhost:3001',
    playerId,
    playerName
  });

  if (isInitializing) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <Text style={styles.loadingText}>Initializing SQLite & Device Identity...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />

      <ScrollView contentContainerStyle={styles.container}>
        {/* App Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.appTitle}>VERTICAL CLIMB</Text>
            <Text style={styles.appSubtitle}>4-Player Real-Time Climbing</Text>
          </View>
          <View style={styles.connectionBadge}>
            <View
              style={[
                styles.statusDot,
                connectionState === 'IN_ROOM' || connectionState === 'MATCH_STARTING'
                  ? styles.dotGreen
                  : connectionState === 'CONNECTED'
                  ? styles.dotBlue
                  : styles.dotGray
              ]}
            />
            <Text style={styles.connectionText}>{connectionState}</Text>
          </View>
        </View>

        {/* Guest Device Identity Banner (expo-sqlite) */}
        {identity && (
          <View style={styles.identityCard}>
            <View style={styles.identityRow}>
              <Text style={styles.identityLabel}>GUEST UUIDv4 (SQLite):</Text>
              <Text style={styles.identityValue} numberOfLines={1}>
                {identity.guestUuid}
              </Text>
            </View>
            <View style={styles.identityRow}>
              <Text style={styles.identityLabel}>NICKNAME:</Text>
              <Text style={styles.identityNickname}>{identity.nickname}</Text>
            </View>
          </View>
        )}

        {/* Error Banner */}
        {error && (
          <TouchableOpacity style={styles.errorBanner} onPress={clearError}>
            <Text style={styles.errorText}>{error}</Text>
            <Text style={styles.errorDismiss}>Dismiss</Text>
          </TouchableOpacity>
        )}

        {/* Match Started Banner */}
        {matchStartPayload && (
          <View style={styles.matchStartedCard}>
            <Text style={styles.matchStartedTitle}>CLIMB IN PROGRESS!</Text>
            <Text style={styles.matchStartedSub}>
              Deterministic 32-bit Seed: 0x{matchStartPayload.seed.toString(16).toUpperCase()}
            </Text>
            <Text style={styles.matchStartedMeta}>
              Goal Height: {matchStartPayload.climbGoalHeight}m
            </Text>
          </View>
        )}

        {/* Tab Navigation */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'LOBBY' && styles.tabButtonActive]}
            onPress={() => {
              void HapticsService.selection();
              setActiveTab('LOBBY');
            }}
          >
            <Text
              style={[styles.tabText, activeTab === 'LOBBY' && styles.tabTextActive]}
            >
              Lobby
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'OBSTACLES' && styles.tabButtonActive]}
            onPress={() => {
              void HapticsService.selection();
              setActiveTab('OBSTACLES');
            }}
          >
            <Text
              style={[styles.tabText, activeTab === 'OBSTACLES' && styles.tabTextActive]}
            >
              PRNG Obstacles
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabButton,
              activeTab === 'OFFLINE_RECORDS' && styles.tabButtonActive
            ]}
            onPress={() => {
              void HapticsService.selection();
              setActiveTab('OFFLINE_RECORDS');
            }}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'OFFLINE_RECORDS' && styles.tabTextActive
              ]}
            >
              SQLite Scores
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tab Content */}
        {activeTab === 'LOBBY' && (
          <LobbyView
            roomState={roomState}
            playerId={playerId}
            isConnecting={connectionState === 'CONNECTING'}
            onJoinOrCreate={joinOrCreateRoom}
            onToggleReady={toggleReady}
            onStartMatch={startMatch}
            onLeaveRoom={leaveRoom}
          />
        )}

        {activeTab === 'OBSTACLES' && (
          <DeterministicObstaclesView
            initialSeed={matchStartPayload ? matchStartPayload.seed : 424242}
          />
        )}

        {activeTab === 'OFFLINE_RECORDS' && (
          <OfflineRecordsView playerId={playerId} />
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
    marginBottom: 4
  },
  identityLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    width: 140
  },
  identityValue: {
    flex: 1,
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#38BDF8'
  },
  identityNickname: {
    fontSize: 12,
    fontWeight: '700',
    color: '#F8FAFC'
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
  },
  matchStartedCard: {
    backgroundColor: '#14532D',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#22C55E'
  },
  matchStartedTitle: {
    color: '#4ADE80',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1
  },
  matchStartedSub: {
    color: '#BBF7D0',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4
  },
  matchStartedMeta: {
    color: '#86EFAC',
    fontSize: 12,
    marginTop: 2
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderRadius: 10,
    padding: 4,
    marginBottom: 16
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8
  },
  tabButtonActive: {
    backgroundColor: '#3B82F6'
  },
  tabText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700'
  },
  tabTextActive: {
    color: '#FFFFFF'
  }
});
