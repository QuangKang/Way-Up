import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LobbyView } from '../components/LobbyView';
import { DeterministicObstaclesView } from '../components/DeterministicObstaclesView';
import { OfflineRecordsView } from '../components/OfflineRecordsView';
import { HapticsService } from '../haptics/hapticsService';

type LobbyTab = 'LOBBY' | 'OBSTACLES' | 'OFFLINE_RECORDS';

export interface LobbyScreenProps {
  playerId: string;
  isConnecting: boolean;
  isConnected: boolean;
  previewSeed?: number;
  onJoinOrCreateRoom: (roomCode?: string) => void;
}

export const LobbyScreen: React.FC<LobbyScreenProps> = ({
  playerId,
  isConnecting,
  isConnected,
  previewSeed = 424242,
  onJoinOrCreateRoom
}) => {
  const [activeTab, setActiveTab] = useState<LobbyTab>('LOBBY');

  return (
    <View>
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'LOBBY' && styles.tabButtonActive
          ]}
          onPress={() => {
            void HapticsService.selection();
            setActiveTab('LOBBY');
          }}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'LOBBY' && styles.tabTextActive
            ]}
          >
            Lobby
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'OBSTACLES' && styles.tabButtonActive
          ]}
          onPress={() => {
            void HapticsService.selection();
            setActiveTab('OBSTACLES');
          }}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'OBSTACLES' && styles.tabTextActive
            ]}
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

      {activeTab === 'LOBBY' && (
        <LobbyView
          isConnecting={isConnecting}
          isConnected={isConnected}
          onJoinOrCreate={onJoinOrCreateRoom}
        />
      )}

      {activeTab === 'OBSTACLES' && (
        <DeterministicObstaclesView initialSeed={previewSeed} />
      )}

      {activeTab === 'OFFLINE_RECORDS' && (
        <OfflineRecordsView playerId={playerId} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderRadius: 10,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155'
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
