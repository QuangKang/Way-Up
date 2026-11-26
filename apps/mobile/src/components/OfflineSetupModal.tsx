import React, { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import {
  BotDifficulty,
  CLIMBER_COLORS,
  DEFAULT_MATCH_SETTINGS,
  MatchSettings,
  TIME_LIMIT_PRESETS
} from '@climb/shared';
import { useLanguage } from '../i18n/LanguageContext';
import { SoundService } from '../services/soundService';
import { ClimberAvatar, SnowyRockHold } from './MountainArtwork';

export interface OfflineLaunchConfig {
  playerColor: string;
  botDifficulty: BotDifficulty;
  settings: MatchSettings;
}

export interface OfflineSetupModalProps {
  visible: boolean;
  initialColor: string;
  onSelectColor: (color: string) => void;
  onStartOffline: (config: OfflineLaunchConfig) => void;
  onClose: () => void;
}

const DIFFICULTIES: readonly BotDifficulty[] = ['EASY', 'MEDIUM', 'HARD'];

function formatPresetMinutes(sec: number): string {
  return `${Math.round(sec / 60)}m`;
}

export const OfflineSetupModal: React.FC<OfflineSetupModalProps> = ({
  visible,
  initialColor,
  onSelectColor,
  onStartOffline,
  onClose
}) => {
  const { t } = useLanguage();
  const [selectedColor, setSelectedColor] = useState<string>(initialColor);
  const [botDifficulty, setBotDifficulty] = useState<BotDifficulty>('MEDIUM');
  const [enableBoulders, setEnableBoulders] = useState<boolean>(
    DEFAULT_MATCH_SETTINGS.enableBoulders
  );
  const [enableIce, setEnableIce] = useState<boolean>(
    DEFAULT_MATCH_SETTINGS.enableIce
  );
  const [timeLimitSec, setTimeLimitSec] = useState<number>(
    DEFAULT_MATCH_SETTINGS.timeLimitSec
  );

  useEffect(() => {
    setSelectedColor(initialColor);
  }, [initialColor]);

  const handleChooseColor = (color: string) => {
    SoundService.play('ui_tap');
    setSelectedColor(color);
    onSelectColor(color);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.kicker}>{t.setupKicker}</Text>
              <Text style={styles.title}>{t.setupTitle}</Text>
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

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollBody}
          >
            {/* Live Climber Preview + Color Picker */}
            <View style={styles.previewCard}>
              <View style={styles.avatarPreviewBox}>
                <ClimberAvatar jacketColor={selectedColor} />
                <View style={styles.holdPedestal}>
                  <SnowyRockHold width={68} />
                </View>
              </View>

              <View style={styles.colorPickerCol}>
                <Text style={styles.sectionLabel}>{t.chooseColorLabel}</Text>
                <View style={styles.swatchWrap}>
                  {CLIMBER_COLORS.map((color) => {
                    const active = selectedColor === color;
                    return (
                      <Pressable
                        key={color}
                        style={[
                          styles.colorSwatch,
                          { backgroundColor: color },
                          active && styles.colorSwatchSelected
                        ]}
                        onPress={() => handleChooseColor(color)}
                      >
                        {active && <Text style={styles.swatchCheck}>✓</Text>}
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </View>

            {/* Bot Difficulty Selector */}
            <View style={styles.blockCard}>
              <Text style={styles.sectionLabel}>{t.botDifficultyLabel}</Text>
              <View style={styles.segmentedRow}>
                {DIFFICULTIES.map((diff) => {
                  const active = botDifficulty === diff;
                  return (
                    <Pressable
                      key={diff}
                      style={[
                        styles.segmentBtn,
                        active && styles.segmentBtnActive
                      ]}
                      onPress={() => {
                        SoundService.play('ui_tap');
                        setBotDifficulty(diff);
                      }}
                    >
                      <Text
                        style={[
                          styles.segmentBtnText,
                          active && styles.segmentBtnTextActive
                        ]}
                      >
                        {t.difficulty[diff]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Hazard Toggles */}
            <View style={styles.blockCard}>
              <View style={styles.hazardToggleRow}>
                <Text style={styles.hazardLabel}>🪨 {t.fallingBouldersLabel}</Text>
                <Pressable
                  style={[
                    styles.miniToggle,
                    enableBoulders ? styles.miniToggleOn : styles.miniToggleOff
                  ]}
                  onPress={() => {
                    SoundService.play('ui_tap');
                    setEnableBoulders((prev) => !prev);
                  }}
                >
                  <Text style={styles.miniToggleText}>
                    {enableBoulders ? t.on : t.off}
                  </Text>
                </Pressable>
              </View>

              <View style={[styles.hazardToggleRow, styles.hazardDividerTop]}>
                <Text style={styles.hazardLabel}>🧊 {t.icyLedgesLabel}</Text>
                <Pressable
                  style={[
                    styles.miniToggle,
                    enableIce ? styles.miniToggleOn : styles.miniToggleOff
                  ]}
                  onPress={() => {
                    SoundService.play('ui_tap');
                    setEnableIce((prev) => !prev);
                  }}
                >
                  <Text style={styles.miniToggleText}>
                    {enableIce ? t.on : t.off}
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Time Limit Presets (1m / 2m / 3m / 5m) */}
            <View style={styles.blockCard}>
              <Text style={styles.sectionLabel}>⏱ {t.timeLimitLabel}</Text>
              <View style={styles.segmentedRow}>
                {TIME_LIMIT_PRESETS.map((sec) => {
                  const active = timeLimitSec === sec;
                  return (
                    <Pressable
                      key={sec}
                      style={[
                        styles.segmentBtn,
                        active && styles.segmentBtnActive
                      ]}
                      onPress={() => {
                        SoundService.play('ui_tap');
                        setTimeLimitSec(sec);
                      }}
                    >
                      <Text
                        style={[
                          styles.segmentBtnText,
                          active && styles.segmentBtnTextActive
                        ]}
                      >
                        {formatPresetMinutes(sec)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </ScrollView>

          <Pressable
            style={({ pressed }) => [
              styles.startBtn,
              pressed && styles.startBtnPressed
            ]}
            onPress={() => {
              SoundService.play('ui_tap');
              onStartOffline({
                playerColor: selectedColor,
                botDifficulty,
                settings: {
                  enableBoulders,
                  enableIce,
                  timeLimitSec
                }
              });
            }}
          >
            <Text style={styles.startBtnText}>{t.startClimbBtn}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(6, 11, 22, 0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18
  },
  sheet: {
    width: '100%',
    maxWidth: 410,
    maxHeight: '88%',
    backgroundColor: '#122038',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1.5,
    borderColor: '#F59E0B'
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  kicker: {
    color: '#FBBF24',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2
  },
  title: {
    color: '#F8FAFC',
    fontSize: 21,
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
  scrollBody: {
    gap: 10,
    paddingBottom: 6
  },
  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0B1424',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1E314F',
    gap: 14
  },
  avatarPreviewBox: {
    width: 82,
    height: 82,
    borderRadius: 14,
    backgroundColor: '#13233D',
    borderWidth: 1,
    borderColor: '#294266',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 6
  },
  holdPedestal: {
    marginTop: -2
  },
  colorPickerCol: {
    flex: 1
  },
  sectionLabel: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 8
  },
  swatchWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  colorSwatch: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)'
  },
  colorSwatchSelected: {
    borderColor: '#FFFFFF',
    borderWidth: 2.5,
    transform: [{ scale: 1.08 }]
  },
  swatchCheck: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900'
  },
  blockCard: {
    backgroundColor: '#0B1424',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1E314F'
  },
  segmentedRow: {
    flexDirection: 'row',
    backgroundColor: '#070E1A',
    borderRadius: 10,
    padding: 4,
    gap: 6
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  segmentBtnActive: {
    backgroundColor: '#0284C7'
  },
  segmentBtnText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '800'
  },
  segmentBtnTextActive: {
    color: '#FFFFFF'
  },
  hazardToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  hazardDividerTop: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#182842'
  },
  hazardLabel: {
    color: '#F1F5F9',
    fontSize: 13,
    fontWeight: '800'
  },
  miniToggle: {
    minWidth: 58,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderBottomWidth: 2
  },
  miniToggleOn: {
    backgroundColor: '#059669',
    borderBottomColor: '#065F46'
  },
  miniToggleOff: {
    backgroundColor: '#334155',
    borderBottomColor: '#1E293B'
  },
  miniToggleText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900'
  },
  startBtn: {
    marginTop: 12,
    backgroundColor: '#EA580C',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    borderBottomWidth: 4,
    borderBottomColor: '#9A3412'
  },
  startBtnPressed: {
    transform: [{ translateY: 2 }],
    borderBottomWidth: 2
  },
  startBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.4
  }
});
