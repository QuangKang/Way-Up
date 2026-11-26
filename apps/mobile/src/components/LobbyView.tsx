import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { HapticsService } from '../haptics/hapticsService';

interface LobbyViewProps {
  isConnecting: boolean;
  isConnected: boolean;
  onJoinOrCreate: (roomCode?: string) => void;
}

export const LobbyView: React.FC<LobbyViewProps> = ({
  isConnecting,
  isConnected,
  onJoinOrCreate
}) => {
  const [inputCode, setInputCode] = useState('');

  const cleanedCode = inputCode.trim().toUpperCase();
  const canJoin = cleanedCode.length === 4 && isConnected && !isConnecting;

  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Multiplayer Climbing Lobby</Text>
      <Text style={styles.description}>
        Host a room (supports 1-player Solo Test or 2–4 player races) or enter a
        4-character code to join friends.
      </Text>

      <TouchableOpacity
        style={[
          styles.button,
          styles.primaryButton,
          (!isConnected || isConnecting) && styles.buttonDisabled
        ]}
        disabled={!isConnected || isConnecting}
        onPress={() => {
          void HapticsService.selection();
          onJoinOrCreate();
        }}
      >
        <Text style={styles.buttonText}>
          {isConnecting
            ? 'Connecting to Server...'
            : !isConnected
            ? 'Server Offline'
            : 'Create New Room'}
        </Text>
      </TouchableOpacity>

      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>OR JOIN WITH 4-CHAR CODE</Text>
        <View style={styles.dividerLine} />
      </View>

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="ABCD"
          placeholderTextColor="#64748B"
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={4}
          value={inputCode}
          onChangeText={(text) =>
            setInputCode(text.replace(/[^a-zA-Z0-9]/g, '').toUpperCase())
          }
        />
        <TouchableOpacity
          style={[
            styles.button,
            styles.secondaryButton,
            !canJoin && styles.buttonDisabled
          ]}
          disabled={!canJoin}
          onPress={() => {
            void HapticsService.selection();
            onJoinOrCreate(cleanedCode);
          }}
        >
          <Text style={styles.secondaryButtonText}>Join Room</Text>
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
    fontWeight: '800',
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
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 12,
    letterSpacing: 0.5
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
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 4,
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
    paddingHorizontal: 20
  },
  buttonDisabled: {
    opacity: 0.45
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15
  },
  secondaryButtonText: {
    color: '#F8FAFC',
    fontWeight: '700',
    fontSize: 14
  }
});
