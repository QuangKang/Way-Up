import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { AppLanguage } from '../db/preferencesService';
import { useLanguage } from '../i18n/LanguageContext';
import { SoundService } from '../services/soundService';

export interface SettingsModalProps {
  visible: boolean;
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  onToggleSound: (next: boolean) => void;
  onToggleHaptics: (next: boolean) => void;
  onSelectLanguage: (lang: AppLanguage) => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  visible,
  soundEnabled,
  hapticsEnabled,
  onToggleSound,
  onToggleHaptics,
  onSelectLanguage,
  onClose
}) => {
  const { language, t } = useLanguage();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.kicker}>{t.settingsKicker}</Text>
              <Text style={styles.title}>{t.settingsTitle}</Text>
            </View>
            <Pressable
              style={({ pressed }) => [
                styles.closeBtn,
                pressed && styles.closeBtnPressed
              ]}
              onPress={() => {
                SoundService.play('ui_tap');
                onClose();
              }}
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
          </View>

          {/* Language Selector: EN / Tiếng Việt */}
          <View style={styles.settingBlock}>
            <Text style={styles.blockLabel}>{t.languageLabel}</Text>
            <View style={styles.segmentedRow}>
              <Pressable
                style={[
                  styles.segmentPill,
                  language === 'en' && styles.segmentPillActive
                ]}
                onPress={() => {
                  SoundService.play('ui_tap');
                  onSelectLanguage('en');
                }}
              >
                <Text
                  numberOfLines={1}
                  style={[
                    styles.segmentText,
                    language === 'en' && styles.segmentTextActive
                  ]}
                >
                  {t.langEnglish}
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.segmentPill,
                  language === 'vi' && styles.segmentPillActive
                ]}
                onPress={() => {
                  SoundService.play('ui_tap');
                  onSelectLanguage('vi');
                }}
              >
                <Text
                  numberOfLines={1}
                  style={[
                    styles.segmentText,
                    language === 'vi' && styles.segmentTextActive
                  ]}
                >
                  {t.langVietnamese}
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Sound Toggle */}
          <View style={styles.toggleRowCard}>
            <View style={styles.toggleCopyCol}>
              <Text style={styles.toggleTitle}>🔊 {t.soundLabel}</Text>
              <Text style={styles.toggleHint}>{t.soundHint}</Text>
            </View>
            <Pressable
              style={[
                styles.switchPill,
                soundEnabled ? styles.switchPillOn : styles.switchPillOff
              ]}
              onPress={() => {
                const next = !soundEnabled;
                onToggleSound(next);
                SoundService.play('ui_tap');
              }}
            >
              <Text style={styles.switchPillText}>
                {soundEnabled ? t.on : t.off}
              </Text>
            </Pressable>
          </View>

          {/* Haptics Toggle */}
          <View style={styles.toggleRowCard}>
            <View style={styles.toggleCopyCol}>
              <Text style={styles.toggleTitle}>📳 {t.hapticsLabel}</Text>
              <Text style={styles.toggleHint}>{t.hapticsHint}</Text>
            </View>
            <Pressable
              style={[
                styles.switchPill,
                hapticsEnabled ? styles.switchPillOn : styles.switchPillOff
              ]}
              onPress={() => {
                const next = !hapticsEnabled;
                onToggleHaptics(next);
                if (next) {
                  SoundService.play('ui_tap');
                }
              }}
            >
              <Text style={styles.switchPillText}>
                {hapticsEnabled ? t.on : t.off}
              </Text>
            </Pressable>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.doneBtn,
              pressed && styles.doneBtnPressed
            ]}
            onPress={() => {
              SoundService.play('ui_tap');
              onClose();
            }}
          >
            <Text style={styles.doneBtnText}>{t.close}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(6, 11, 22, 0.86)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20
  },
  card: {
    width: '100%',
    maxWidth: 390,
    backgroundColor: '#122038',
    borderRadius: 22,
    padding: 20,
    borderWidth: 1.5,
    borderColor: '#38BDF8',
    gap: 12
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2
  },
  kicker: {
    color: '#7DD3FC',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2
  },
  title: {
    color: '#F8FAFC',
    fontSize: 22,
    fontWeight: '900',
    marginTop: 1
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#1E2F4D',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#334E78'
  },
  closeBtnPressed: {
    backgroundColor: '#2B436B'
  },
  closeBtnText: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '900'
  },
  settingBlock: {
    backgroundColor: '#0B1424',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1E314F'
  },
  blockLabel: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 8
  },
  segmentedRow: {
    flexDirection: 'row',
    backgroundColor: '#070E1A',
    borderRadius: 10,
    padding: 4,
    gap: 6
  },
  segmentPill: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  segmentPillActive: {
    backgroundColor: '#0284C7'
  },
  segmentText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '800'
  },
  segmentTextActive: {
    color: '#FFFFFF'
  },
  toggleRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0B1424',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#1E314F',
    gap: 12
  },
  toggleCopyCol: {
    flex: 1
  },
  toggleTitle: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '800'
  },
  toggleHint: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2
  },
  switchPill: {
    minWidth: 62,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderBottomWidth: 3
  },
  switchPillOn: {
    backgroundColor: '#059669',
    borderBottomColor: '#065F46'
  },
  switchPillOff: {
    backgroundColor: '#334155',
    borderBottomColor: '#1E293B'
  },
  switchPillText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900'
  },
  doneBtn: {
    marginTop: 4,
    backgroundColor: '#0284C7',
    paddingVertical: 13,
    borderRadius: 13,
    alignItems: 'center',
    borderBottomWidth: 4,
    borderBottomColor: '#075985'
  },
  doneBtnPressed: {
    transform: [{ translateY: 2 }],
    borderBottomWidth: 2
  },
  doneBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900'
  }
});
