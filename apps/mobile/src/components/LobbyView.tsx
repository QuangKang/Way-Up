import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { Player, RoomState } from '@climb/shared';
import { HapticsService } from '../haptics/hapticsService';

interface LobbyViewProps {
  roomState: RoomState | null;
  playerId: string;
  isConnecting: boolean;
  onJoinOrCreate: (roomCode?: string) => void;
  onToggleReady: () => void;
  onStartMatch: () => void;
  onLeaveRoom: () => void;
}

export const LobbyView: React.FC<LobbyViewProps> = ({
  roomState,
  playerId,
  isConnecting,
  onJoinOrCreate,
  onToggleReady,
  onStartMatch,
  onLeaveRoom
}) => {
  const [inputCode, setInputCode] = useState('');

  if (!roomState) {
    return (
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Multiplayer Climbing Lobby</Text>
        <Text style={styles.description}>
          Create a new room or join an existing 4-character room code to climb with 2–4 players.
        </Text>

        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          disabled={isConnecting}
          onPress={() => {
            void HapticsService.selection();
            onJoinOrCreate();
          }}
        >
          <Text style={styles.buttonText}>
            {isConnecting ? 'Connecting...' : 'Create New Room'}
          </Text>
        </TouchableOpacity>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>OR JOIN WITH CODE</Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="4-CHAR CODE"
            placeholderTextColor="#64748B"
            autoCapitalize="characters"
            maxLength={4}
            value={inputCode}
            onChangeText={(t) => setInputCode(t.toUpperCase())}
          />
          <TouchableOpacity
            style={[styles.button, styles.secondaryButton, inputCode.length !== 4 && styles.buttonDisabled]}
            disabled={inputCode.length !== 4 || isConnecting}
            onPress={() => {
              void HapticsService.selection();
              onJoinOrCreate(inputCode);
            }}
          >
            <Text style={styles.secondaryButtonText}>Join Room</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const selfPlayer = roomState.players.find((p) => p.id === playerId);
  const isHost = selfPlayer?.isHost ?? false;
  const canStart =
    isHost &&
    roomState.players.length >= roomState.minPlayers &&
    roomState.players.every((p) => p.isReady || p.isHost);

  return (
    <View style={styles.card}>
      <View style={styles.roomHeader}>
        <View>
          <Text style={styles.roomLabel}>ROOM CODE</Text>
          <Text style={styles.roomCode}>{roomState.code}</Text>
        </View>
        <View style={styles.playerCountBadge}>
          <Text style={styles.playerCountText}>
            {roomState.players.length}/{roomState.maxPlayers} PLAYERS
          </Text>
        </View>
      </View>

      <Text style={styles.subTitle}>Lobby Roster (2–4 Players)</Text>
      <View style={styles.playerList}>
        {roomState.players.map((player: Player, index: number) => (
          <View key={player.id} style={styles.playerRow}>
            <View style={[styles.colorIndicator, { backgroundColor: player.color }]} />
            <View style={styles.playerInfo}>
              <Text style={styles.playerName}>
                {player.name} {player.id === playerId ? '(You)' : ''}
              </Text>
              <Text style={styles.playerSub}>Slot #{index + 1}</Text>
            </View>
            <View style={styles.statusBadges}>
              {player.isHost && <Text style={styles.hostBadge}>HOST</Text>}
              <Text
                style={[
                  styles.readyBadge,
                  player.isReady ? styles.readyActive : styles.readyWaiting
                ]}
              >
                {player.isReady ? 'READY' : 'WAITING'}
              </Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.actionRow}>
        {!isHost && (
          <TouchableOpacity
            style={[
              styles.button,
              selfPlayer?.isReady ? styles.warningButton : styles.primaryButton
            ]}
            onPress={onToggleReady}
          >
            <Text style={styles.buttonText}>
              {selfPlayer?.isReady ? 'Set Not Ready' : 'Set Ready'}
            </Text>
          </TouchableOpacity>
        )}

        {isHost && (
          <TouchableOpacity
            style={[styles.button, styles.primaryButton, !canStart && styles.buttonDisabled]}
            disabled={!canStart}
            onPress={() => {
              void HapticsService.springBoost();
              onStartMatch();
            }}
          >
            <Text style={styles.buttonText}>
              {roomState.players.length < roomState.minPlayers
                ? `Need ${roomState.minPlayers - roomState.players.length} More Player`
                : !canStart
                ? 'Waiting for Players Ready'
                : 'Start Climb (ROOM_START)'}
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.button, styles.dangerButton]}
          onPress={onLeaveRoom}
        >
          <Text style={styles.dangerButtonText}>Leave Room</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155'
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 8
  },
  description: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 20,
    lineHeight: 20
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 18
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#334155'
  },
  dividerText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 12
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12
  },
  input: {
    flex: 1,
    backgroundColor: '#0F172A',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 2,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: '#475569'
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  primaryButton: {
    backgroundColor: '#3B82F6'
  },
  secondaryButton: {
    backgroundColor: '#334155',
    paddingHorizontal: 18
  },
  warningButton: {
    backgroundColor: '#D97706'
  },
  dangerButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#EF4444',
    marginTop: 10
  },
  buttonDisabled: {
    opacity: 0.4
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15
  },
  secondaryButtonText: {
    color: '#F8FAFC',
    fontWeight: '600',
    fontSize: 14
  },
  dangerButtonText: {
    color: '#EF4444',
    fontWeight: '600',
    fontSize: 14
  },
  roomHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#334155'
  },
  roomLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 1
  },
  roomCode: {
    fontSize: 32,
    fontWeight: '900',
    color: '#38BDF8',
    letterSpacing: 4
  },
  playerCountBadge: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#334155'
  },
  playerCountText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700'
  },
  subTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#94A3B8',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  playerList: {
    gap: 10,
    marginBottom: 20
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    padding: 12,
    borderRadius: 10
  },
  colorIndicator: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginRight: 12
  },
  playerInfo: {
    flex: 1
  },
  playerName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#F8FAFC'
  },
  playerSub: {
    fontSize: 11,
    color: '#64748B'
  },
  statusBadges: {
    flexDirection: 'row',
    gap: 6
  },
  hostBadge: {
    backgroundColor: '#EAB308',
    color: '#000000',
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  readyBadge: {
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4
  },
  readyActive: {
    backgroundColor: '#065F46',
    color: '#34D399'
  },
  readyWaiting: {
    backgroundColor: '#374151',
    color: '#9CA3AF'
  },
  actionRow: {
    gap: 8
  }
});
