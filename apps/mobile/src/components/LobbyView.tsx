import React, { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
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
  const canCreate = isConnected && !isConnecting;

  return (
    <View style={styles.card}>
      {/* Expedition Brief Header */}
      <View style={styles.expeditionHeader}>
        <View style={styles.summitTag}>
          <Text style={styles.summitTagText}>500M SUMMIT RACE</Text>
        </View>
        <Text style={styles.sectionTitle}>Basecamp Expedition</Text>
        <Text style={styles.description}>
          Race up the twin-lane cliff face! Alternate Left & Right holds, climb
          off icy ledges before you slip, and dodge falling boulders.
        </Text>
      </View>

      {/* 3-Biome Elevation Preview Strip */}
      <View style={styles.biomeStrip}>
        <View style={styles.biomeStage}>
          <View style={[styles.biomeBar, { backgroundColor: '#22C55E' }]} />
          <Text style={styles.biomeName}>Foothills</Text>
          <Text style={styles.biomeAlt}>0–150m</Text>
        </View>
        <View style={styles.biomeStage}>
          <View style={[styles.biomeBar, { backgroundColor: '#38BDF8' }]} />
          <Text style={styles.biomeName}>Steep Cliffs</Text>
          <Text style={styles.biomeAlt}>150–350m</Text>
        </View>
        <View style={styles.biomeStage}>
          <View style={[styles.biomeBar, { backgroundColor: '#FBBF24' }]} />
          <Text style={styles.biomeName}>Alpine Summit</Text>
          <Text style={styles.biomeAlt}>350–500m</Text>
        </View>
      </View>

      {/* Primary Tactile CTA */}
      <Pressable
        style={({ pressed }) => [
          styles.primaryButton,
          !canCreate && styles.buttonDisabled,
          pressed && canCreate && styles.primaryButtonPressed
        ]}
        disabled={!canCreate}
        onPress={() => {
          void HapticsService.selection();
          onJoinOrCreate();
        }}
      >
        <Text style={styles.primaryButtonTitle}>
          {isConnecting
            ? 'Connecting to Basecamp...'
            : !isConnected
            ? 'Basecamp Server Offline'
            : '▲ Start New Expedition'}
        </Text>
        {canCreate && (
          <Text style={styles.primaryButtonSub}>
            Host 1-Player Solo Climb or 2–4 Player Race
          </Text>
        )}
      </Pressable>

      {/* Divider */}
      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>OR JOIN CREW BY CODE</Text>
        <View style={styles.dividerLine} />
      </View>

      {/* 4-Char Code Join Row */}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="ABCD"
          placeholderTextColor="#475569"
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={4}
          value={inputCode}
          onChangeText={(text) =>
            setInputCode(text.replace(/[^a-zA-Z0-9]/g, '').toUpperCase())
          }
        />
        <Pressable
          style={({ pressed }) => [
            styles.secondaryButton,
            !canJoin && styles.buttonDisabled,
            pressed && canJoin && styles.secondaryButtonPressed
          ]}
          disabled={!canJoin}
          onPress={() => {
            void HapticsService.selection();
            onJoinOrCreate(cleanedCode);
          }}
        >
          <Text style={styles.secondaryButtonText}>Join Room</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#132036',
    borderRadius: 18,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#263B59'
  },
  expeditionHeader: {
    marginBottom: 14
  },
  summitTag: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(245, 158, 11, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.4)',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 8
  },
  summitTagText: {
    color: '#FBBF24',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8
  },
  sectionTitle: {
    fontSize: 21,
    fontWeight: '900',
    color: '#F8FAFC',
    marginBottom: 6,
    letterSpacing: 0.2
  },
  description: {
    fontSize: 13,
    color: '#94A3B8',
    lineHeight: 19
  },
  biomeStrip: {
    flexDirection: 'row',
    backgroundColor: '#0B1424',
    borderRadius: 12,
    padding: 10,
    gap: 8,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#1D2E49'
  },
  biomeStage: {
    flex: 1
  },
  biomeBar: {
    height: 4,
    borderRadius: 2,
    marginBottom: 5
  },
  biomeName: {
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: '800'
  },
  biomeAlt: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 1
  },
  primaryButton: {
    backgroundColor: '#EA580C',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 4,
    borderBottomColor: '#9A3412'
  },
  primaryButtonPressed: {
    transform: [{ translateY: 2 }],
    borderBottomWidth: 2
  },
  primaryButtonTitle: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 16,
    letterSpacing: 0.3
  },
  primaryButtonSub: {
    color: '#FFEDD5',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 18
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#243754'
  },
  dividerText: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 12,
    letterSpacing: 0.8
  },
  inputRow: {
    flexDirection: 'row',
    gap: 10
  },
  input: {
    flex: 1,
    backgroundColor: '#0A1220',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#F8FAFC',
    fontSize: 19,
    fontWeight: '900',
    letterSpacing: 5,
    textAlign: 'center',
    borderWidth: 1.5,
    borderColor: '#2E476B'
  },
  secondaryButton: {
    backgroundColor: '#0284C7',
    paddingHorizontal: 22,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 4,
    borderBottomColor: '#075985'
  },
  secondaryButtonPressed: {
    transform: [{ translateY: 2 }],
    borderBottomWidth: 2
  },
  secondaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 14
  },
  buttonDisabled: {
    opacity: 0.45
  }
});
