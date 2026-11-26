import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { useLanguage } from '../i18n/LanguageContext';
import { SoundService } from '../services/soundService';
import {
  BlizzardGustMiniature,
  FallingBoulderMiniature,
  SnowyIceHold,
  SnowyRockHold
} from './MountainArtwork';

export interface HowToPlayModalProps {
  visible: boolean;
  onClose: () => void;
}

export const HowToPlayModal: React.FC<HowToPlayModalProps> = ({
  visible,
  onClose
}) => {
  const { t } = useLanguage();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.kicker}>{t.guideKicker}</Text>
              <Text style={styles.title}>{t.guideTitle}</Text>
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
            contentContainerStyle={styles.scrollContent}
          >
            {/* Core Left / Right Tap Rule */}
            <View style={styles.tapRuleCard}>
              <View style={styles.tapMiniButtonsRow}>
                <View style={styles.tapMiniPill}>
                  <Text style={styles.tapMiniText}>{t.guideTapLeft}</Text>
                </View>
                <View style={styles.tapMiniPill}>
                  <Text style={styles.tapMiniText}>{t.guideTapRight}</Text>
                </View>
              </View>
              <Text style={styles.tapRuleBody}>{t.guideTapRule}</Text>
            </View>

            {/* 1. Wide Snowy Rock Hold */}
            <View style={styles.guideRow}>
              <View style={styles.previewStage}>
                <SnowyRockHold width={74} isTarget />
              </View>
              <View style={styles.guideTextCol}>
                <Text style={styles.itemTitle}>{t.guideRockTitle}</Text>
                <Text style={styles.itemDesc}>{t.guideRockDesc}</Text>
              </View>
            </View>

            {/* 2. Icy Slippery Hold */}
            <View style={styles.guideRow}>
              <View style={styles.previewStage}>
                <SnowyIceHold width={56} slipProgress={0.55} />
              </View>
              <View style={styles.guideTextCol}>
                <Text style={[styles.itemTitle, { color: '#7DD3FC' }]}>
                  {t.guideIceTitle}
                </Text>
                <Text style={styles.itemDesc}>{t.guideIceDesc}</Text>
              </View>
            </View>

            {/* 3. Falling Boulder */}
            <View style={styles.guideRow}>
              <View style={styles.previewStage}>
                <FallingBoulderMiniature />
              </View>
              <View style={styles.guideTextCol}>
                <Text style={[styles.itemTitle, { color: '#FCA5A5' }]}>
                  {t.guideBoulderTitle}
                </Text>
                <Text style={styles.itemDesc}>{t.guideBoulderDesc}</Text>
              </View>
            </View>

            {/* 4. Blizzard Gust */}
            <View style={styles.guideRow}>
              <View style={styles.previewStage}>
                <BlizzardGustMiniature />
              </View>
              <View style={styles.guideTextCol}>
                <Text style={[styles.itemTitle, { color: '#BAE6FD' }]}>
                  {t.guideBlizzardTitle}
                </Text>
                <Text style={styles.itemDesc}>{t.guideBlizzardDesc}</Text>
              </View>
            </View>
          </ScrollView>

          <Pressable
            style={({ pressed }) => [
              styles.gotItBtn,
              pressed && styles.gotItBtnPressed
            ]}
            onPress={() => {
              SoundService.play('ui_tap');
              onClose();
            }}
          >
            <Text style={styles.gotItText}>{t.guideGotIt}</Text>
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
    padding: 18
  },
  sheet: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '88%',
    backgroundColor: '#121F36',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1.5,
    borderColor: '#2B456B'
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
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
  scrollContent: {
    gap: 10,
    paddingBottom: 6
  },
  tapRuleCard: {
    backgroundColor: '#0A1322',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#243B5E'
  },
  tapMiniButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8
  },
  tapMiniPill: {
    flex: 1,
    backgroundColor: '#172E54',
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#38BDF8'
  },
  tapMiniText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.6
  },
  tapRuleBody: {
    color: '#CBD5E1',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600'
  },
  guideRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0B1424',
    borderRadius: 14,
    padding: 11,
    borderWidth: 1,
    borderColor: '#1E314F',
    gap: 12
  },
  previewStage: {
    width: 84,
    height: 60,
    borderRadius: 10,
    backgroundColor: '#14233C',
    alignItems: 'center',
    justifyContent: 'center'
  },
  guideTextCol: {
    flex: 1
  },
  itemTitle: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 3
  },
  itemDesc: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600'
  },
  gotItBtn: {
    marginTop: 12,
    backgroundColor: '#0284C7',
    paddingVertical: 13,
    borderRadius: 13,
    alignItems: 'center',
    borderBottomWidth: 4,
    borderBottomColor: '#075985'
  },
  gotItBtnPressed: {
    transform: [{ translateY: 2 }],
    borderBottomWidth: 2
  },
  gotItText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900'
  }
});
