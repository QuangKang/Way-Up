import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { HowToPlayModal } from '../components/HowToPlayModal';
import { OfflineRecordsView } from '../components/OfflineRecordsView';
import {
  OfflineLaunchConfig,
  OfflineSetupModal
} from '../components/OfflineSetupModal';
import { SettingsModal } from '../components/SettingsModal';
import { AppLanguage } from '../db/preferencesService';
import { useLanguage } from '../i18n/LanguageContext';
import { SoundService } from '../services/soundService';

export interface LobbyScreenProps {
  playerId: string;
  preferredColor: string;
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  isConnecting: boolean;
  isConnected: boolean;
  serverError: string | null;
  onClearError: () => void;
  onSelectPreferredColor: (color: string) => void;
  onToggleSound: (next: boolean) => void;
  onToggleHaptics: (next: boolean) => void;
  onSelectLanguage: (lang: AppLanguage) => void;
  onLongPressTitle: () => void;
  onCreateOnlineRoom: () => void;
  onJoinOnlineRoom: (roomCode: string) => void;
  onStartOfflineMatch: (config: OfflineLaunchConfig) => void;
}

export const LobbyScreen: React.FC<LobbyScreenProps> = ({
  playerId,
  preferredColor,
  soundEnabled,
  hapticsEnabled,
  isConnecting,
  isConnected,
  serverError,
  onClearError,
  onSelectPreferredColor,
  onToggleSound,
  onToggleHaptics,
  onSelectLanguage,
  onLongPressTitle,
  onCreateOnlineRoom,
  onJoinOnlineRoom,
  onStartOfflineMatch
}) => {
  const { t } = useLanguage();
  const [onlineExpanded, setOnlineExpanded] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [localJoinError, setLocalJoinError] = useState<string | null>(null);

  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [showRecordsModal, setShowRecordsModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showOfflineSetup, setShowOfflineSetup] = useState(false);

  const cleanedCode = joinCode.trim().toUpperCase();
  const canUseOnline = isConnected && !isConnecting;

  const handleSubmitJoin = () => {
    if (cleanedCode.length !== 4) {
      setLocalJoinError(t.joinCodeLengthError);
      return;
    }
    if (!canUseOnline) {
      setLocalJoinError(t.joinServerOfflineError);
      return;
    }
    setLocalJoinError(null);
    onClearError();
    SoundService.play('ui_tap');
    onJoinOnlineRoom(cleanedCode);
  };

  return (
    <View style={styles.homeStage}>
      {/* 3 Smaller Circular Right-Edge Action Buttons (📖, 🏆, ⚙️) */}
      <View style={styles.rightEdgeDock}>
        <Pressable
          accessibilityLabel={t.guideTitle}
          style={({ pressed }) => [
            styles.dockIconBtn,
            styles.dockBookBtn,
            pressed && styles.dockIconBtnPressed
          ]}
          onPress={() => {
            SoundService.play('ui_tap');
            setShowHowToPlay(true);
          }}
        >
          <Text style={styles.dockIconGlyph}>📖</Text>
        </Pressable>

        <Pressable
          accessibilityLabel={t.recordsTitle}
          style={({ pressed }) => [
            styles.dockIconBtn,
            styles.dockTrophyBtn,
            pressed && styles.dockIconBtnPressed
          ]}
          onPress={() => {
            SoundService.play('ui_tap');
            setShowRecordsModal(true);
          }}
        >
          <Text style={styles.dockIconGlyph}>🏆</Text>
        </Pressable>

        <Pressable
          accessibilityLabel={t.settingsTitle}
          style={({ pressed }) => [
            styles.dockIconBtn,
            styles.dockSettingsBtn,
            pressed && styles.dockIconBtnPressed
          ]}
          onPress={() => {
            SoundService.play('ui_tap');
            setShowSettingsModal(true);
          }}
        >
          <Text style={styles.dockIconGlyph}>⚙️</Text>
        </Pressable>
      </View>

      {/* Center Column: Floating WAY UP! Title (no card/box) + Narrower Centered Play Buttons */}
      <View style={styles.centerColumn}>
        {/* Floating Centered Game Title (1.2s long-press opens hidden Dev Info modal) */}
        <Pressable
          delayLongPress={1200}
          onLongPress={onLongPressTitle}
          style={styles.floatingTitleZone}
        >
          <Text style={styles.floatingKicker}>▲ {t.appSubtitle} ▲</Text>
          <Text style={styles.floatingTitle}>WAY UP!</Text>
        </Pressable>

        {/* Narrower Centered Primary Play Buttons (~64% width, max 248px) */}
        <View style={styles.narrowButtonStack}>
          <Pressable
            style={({ pressed }) => [
              styles.primaryCompactBtn,
              styles.onlinePrimaryBtn,
              onlineExpanded && styles.onlinePrimaryBtnExpanded,
              pressed && styles.primaryCompactBtnPressed
            ]}
            onPress={() => {
              SoundService.play('ui_tap');
              setOnlineExpanded((prev) => !prev);
            }}
          >
            <Text style={styles.primaryCompactText}>{t.onlineBtn}</Text>
          </Pressable>

          {/* Expanded Online Sub-Buttons (Centered directly under ONLINE) */}
          {onlineExpanded && (
            <View style={styles.onlineSubStack}>
              {!canUseOnline && (
                <Text style={styles.serverStatusCaption}>
                  {isConnecting ? t.serverConnectingHint : t.serverOfflineHint}
                </Text>
              )}

              <View style={styles.onlineSubRow}>
                <Pressable
                  style={({ pressed }) => [
                    styles.onlineSubBtn,
                    styles.createSubBtn,
                    !canUseOnline && styles.btnDisabled,
                    pressed && canUseOnline && styles.primaryCompactBtnPressed
                  ]}
                  disabled={!canUseOnline}
                  onPress={() => {
                    SoundService.play('ui_tap');
                    onClearError();
                    onCreateOnlineRoom();
                  }}
                >
                  <Text style={styles.onlineSubBtnText}>{t.createRoom}</Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [
                    styles.onlineSubBtn,
                    styles.joinSubBtn,
                    !canUseOnline && styles.btnDisabled,
                    pressed && canUseOnline && styles.primaryCompactBtnPressed
                  ]}
                  disabled={!canUseOnline}
                  onPress={() => {
                    SoundService.play('ui_tap');
                    setJoinCode('');
                    setLocalJoinError(null);
                    onClearError();
                    setShowJoinModal(true);
                  }}
                >
                  <Text style={styles.onlineSubBtnText}>{t.joinRoom}</Text>
                </Pressable>
              </View>
            </View>
          )}

          <Pressable
            style={({ pressed }) => [
              styles.primaryCompactBtn,
              styles.offlinePrimaryBtn,
              pressed && styles.primaryCompactBtnPressed
            ]}
            onPress={() => {
              SoundService.play('ui_tap');
              setShowOfflineSetup(true);
            }}
          >
            <Text style={styles.primaryCompactText}>{t.offlineBtn}</Text>
          </Pressable>
        </View>
      </View>

      {/* Join Room 4-Char Code Modal */}
      <Modal
        visible={showJoinModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowJoinModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.joinModalCard}>
            <Text style={styles.modalKicker}>{t.joinModalKicker}</Text>
            <Text style={styles.modalTitle}>{t.joinModalTitle}</Text>
            <Text style={styles.modalSub}>{t.joinModalSub}</Text>

            <TextInput
              style={styles.codeInput}
              placeholder="ABCD"
              placeholderTextColor="#475569"
              autoCapitalize="characters"
              autoCorrect={false}
              autoFocus
              maxLength={4}
              value={joinCode}
              onChangeText={(text) => {
                setLocalJoinError(null);
                if (serverError) {
                  onClearError();
                }
                setJoinCode(text.replace(/[^a-zA-Z0-9]/g, '').toUpperCase());
              }}
              returnKeyType="go"
              onSubmitEditing={handleSubmitJoin}
            />

            {(localJoinError || serverError) && (
              <View style={styles.inlineErrorBox}>
                <Text style={styles.inlineErrorText}>
                  {localJoinError ?? serverError}
                </Text>
              </View>
            )}

            <View style={styles.modalActionRow}>
              <Pressable
                style={styles.modalCancelBtn}
                onPress={() => {
                  SoundService.play('ui_tap');
                  onClearError();
                  setLocalJoinError(null);
                  setShowJoinModal(false);
                }}
              >
                <Text style={styles.modalCancelText}>{t.cancel}</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.modalConfirmBtn,
                  cleanedCode.length !== 4 && styles.btnDisabled,
                  pressed &&
                    cleanedCode.length === 4 &&
                    styles.primaryCompactBtnPressed
                ]}
                disabled={cleanedCode.length !== 4}
                onPress={handleSubmitJoin}
              >
                <Text style={styles.modalConfirmText}>{t.joinConfirm}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Offline Pre-Game Setup Modal */}
      <OfflineSetupModal
        visible={showOfflineSetup}
        initialColor={preferredColor}
        onSelectColor={onSelectPreferredColor}
        onClose={() => setShowOfflineSetup(false)}
        onStartOffline={(config) => {
          setShowOfflineSetup(false);
          onStartOfflineMatch(config);
        }}
      />

      {/* Book Icon -> How to Play Modal */}
      <HowToPlayModal
        visible={showHowToPlay}
        onClose={() => setShowHowToPlay(false)}
      />

      {/* Trophy Icon -> Personal Best Records Modal */}
      <Modal
        visible={showRecordsModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRecordsModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.recordsModalCard}>
            <View style={styles.recordsModalHeader}>
              <View>
                <Text style={styles.modalKicker}>{t.recordsKicker}</Text>
                <Text style={styles.modalTitle}>{t.recordsTitle}</Text>
              </View>
              <Pressable
                style={styles.recordsCloseBtn}
                onPress={() => {
                  SoundService.play('ui_tap');
                  setShowRecordsModal(false);
                }}
              >
                <Text style={styles.recordsCloseText}>✕</Text>
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <OfflineRecordsView playerId={playerId} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Cog Icon -> Settings Modal (EN/VI + Sound + Haptics) */}
      <SettingsModal
        visible={showSettingsModal}
        soundEnabled={soundEnabled}
        hapticsEnabled={hapticsEnabled}
        onToggleSound={onToggleSound}
        onToggleHaptics={onToggleHaptics}
        onSelectLanguage={onSelectLanguage}
        onClose={() => setShowSettingsModal(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  homeStage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    paddingBottom: 36
  },
  rightEdgeDock: {
    position: 'absolute',
    right: 4,
    top: 10,
    gap: 10,
    zIndex: 10
  },
  dockIconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(13, 25, 46, 0.92)',
    borderWidth: 1.5,
    borderBottomWidth: 3.5,
    alignItems: 'center',
    justifyContent: 'center'
  },
  dockBookBtn: {
    borderColor: '#38BDF8',
    borderBottomColor: '#0369A1'
  },
  dockTrophyBtn: {
    borderColor: '#FBBF24',
    borderBottomColor: '#B45309'
  },
  dockSettingsBtn: {
    borderColor: '#94A3B8',
    borderBottomColor: '#334155'
  },
  dockIconBtnPressed: {
    transform: [{ translateY: 2 }],
    borderBottomWidth: 2
  },
  dockIconGlyph: {
    fontSize: 18
  },
  centerColumn: {
    width: '100%',
    alignItems: 'center'
  },
  floatingTitleZone: {
    alignItems: 'center',
    marginBottom: 34,
    paddingHorizontal: 16
  },
  floatingKicker: {
    color: '#7DD3FC',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2.2,
    marginBottom: 6,
    textShadowColor: 'rgba(6, 11, 22, 0.9)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4
  },
  floatingTitle: {
    color: '#F8FAFC',
    fontSize: 44,
    fontWeight: '900',
    letterSpacing: 3,
    textAlign: 'center',
    textShadowColor: 'rgba(2, 132, 199, 0.55)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 10
  },
  narrowButtonStack: {
    width: '64%',
    maxWidth: 248,
    minWidth: 196,
    gap: 12,
    alignSelf: 'center'
  },
  primaryCompactBtn: {
    width: '100%',
    paddingVertical: 15,
    paddingHorizontal: 18,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderBottomWidth: 5
  },
  primaryCompactBtnPressed: {
    transform: [{ translateY: 2 }],
    borderBottomWidth: 3
  },
  onlinePrimaryBtn: {
    backgroundColor: '#0284C7',
    borderColor: '#7DD3FC',
    borderBottomColor: '#075985'
  },
  onlinePrimaryBtnExpanded: {
    backgroundColor: '#0369A1'
  },
  offlinePrimaryBtn: {
    backgroundColor: '#EA580C',
    borderColor: '#FDBA74',
    borderBottomColor: '#9A3412'
  },
  primaryCompactText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1.2
  },
  onlineSubStack: {
    width: '100%',
    gap: 8,
    paddingVertical: 4
  },
  serverStatusCaption: {
    color: '#FECACA',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 15
  },
  onlineSubRow: {
    flexDirection: 'row',
    gap: 8
  },
  onlineSubBtn: {
    flex: 1,
    paddingVertical: 11,
    paddingHorizontal: 8,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderBottomWidth: 3.5
  },
  createSubBtn: {
    backgroundColor: '#059669',
    borderColor: '#6EE7B7',
    borderBottomColor: '#065F46'
  },
  joinSubBtn: {
    backgroundColor: '#1D4ED8',
    borderColor: '#93C5FD',
    borderBottomColor: '#1E3A8A'
  },
  onlineSubBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'center'
  },
  btnDisabled: {
    opacity: 0.42
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(6, 11, 22, 0.86)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20
  },
  joinModalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#122038',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1.5,
    borderColor: '#38BDF8'
  },
  recordsModalCard: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '82%',
    backgroundColor: '#122038',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1.5,
    borderColor: '#FBBF24'
  },
  recordsModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14
  },
  recordsCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#1E2F4D',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#334E78'
  },
  recordsCloseText: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '900'
  },
  modalKicker: {
    color: '#7DD3FC',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2
  },
  modalTitle: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: '900',
    marginTop: 2
  },
  modalSub: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 4,
    marginBottom: 14,
    fontWeight: '600'
  },
  codeInput: {
    backgroundColor: '#091220',
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 16,
    color: '#F8FAFC',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 8,
    textAlign: 'center',
    borderWidth: 1.5,
    borderColor: '#38BDF8',
    marginBottom: 12
  },
  inlineErrorBox: {
    backgroundColor: '#7F1D1D',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#EF4444'
  },
  inlineErrorText: {
    color: '#FECACA',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center'
  },
  modalActionRow: {
    flexDirection: 'row',
    gap: 10
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center'
  },
  modalCancelText: {
    color: '#CBD5E1',
    fontSize: 14,
    fontWeight: '800'
  },
  modalConfirmBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: '#0284C7',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 4,
    borderBottomColor: '#075985'
  },
  modalConfirmText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900'
  }
});
