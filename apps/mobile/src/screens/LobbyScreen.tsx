import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LobbyView } from '../components/LobbyView';
import { DeterministicObstaclesView } from '../components/DeterministicObstaclesView';
import { OfflineRecordsView } from '../components/OfflineRecordsView';
import { HapticsService } from '../haptics/hapticsService';

type LobbyTab = 'PLAY' | 'ROUTE_MAP' | 'RECORDS';

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
  const [activeTab, setActiveTab] = useState<LobbyTab>('PLAY');

  const tabs: ReadonlyArray<{ key: LobbyTab; label: string; icon: string }> = [
    { key: 'PLAY', label: 'Play', icon: '▲' },
    { key: 'ROUTE_MAP', label: 'Route Map', icon: '🗺' },
    { key: 'RECORDS', label: 'Records', icon: '🏆' }
  ];

  return (
    <View>
      <View style={styles.tabContainer}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <Pressable
              key={tab.key}
              style={[styles.tabButton, isActive && styles.tabButtonActive]}
              onPress={() => {
                void HapticsService.selection();
                setActiveTab(tab.key);
              }}
            >
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                {tab.icon} {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {activeTab === 'PLAY' && (
        <LobbyView
          isConnecting={isConnecting}
          isConnected={isConnected}
          onJoinOrCreate={onJoinOrCreateRoom}
        />
      )}

      {activeTab === 'ROUTE_MAP' && (
        <DeterministicObstaclesView initialSeed={previewSeed} />
      )}

      {activeTab === 'RECORDS' && <OfflineRecordsView playerId={playerId} />}
    </View>
  );
};

const styles = StyleSheet.create({
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#0E192B',
    borderRadius: 14,
    padding: 4,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#233654',
    gap: 4
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10
  },
  tabButtonActive: {
    backgroundColor: '#1E3A5F',
    borderWidth: 1,
    borderColor: '#38BDF8'
  },
  tabText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.2
  },
  tabTextActive: {
    color: '#F8FAFC'
  }
});
