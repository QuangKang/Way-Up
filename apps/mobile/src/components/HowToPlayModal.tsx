import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
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
              <Text style={styles.kicker}>CLIMBER FIELD GUIDE</Text>
              <Text style={styles.title}>How to Play</Text>
            </View>
            <Pressable
              style={({ pressed }) => [
                styles.closeBtn,
                pressed && styles.closeBtnPressed
              ]}
              onPress={onClose}
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
                  <Text style={styles.tapMiniText}>◀ LEFT</Text>
                </View>
                <View style={styles.tapMiniPill}>
                  <Text style={styles.tapMiniText}>RIGHT ▶</Text>
                </View>
              </View>
              <Text style={styles.tapRuleBody}>
                Tap <Text style={styles.boldWhite}>LEFT</Text> or{' '}
                <Text style={styles.boldWhite}>RIGHT</Text> matching the lane of
                the next hold above you (+10m per step to the{' '}
                <Text style={styles.boldGold}>500m Summit</Text>). Tapping the
                wrong lane slips down 20m!
              </Text>
            </View>

            {/* 1. Wide Snowy Rock Hold */}
            <View style={styles.guideRow}>
              <View style={styles.previewStage}>
                <SnowyRockHold width={74} isTarget />
              </View>
              <View style={styles.guideTextCol}>
                <Text style={styles.itemTitle}>Snowy Rock Hold</Text>
                <Text style={styles.itemDesc}>
                  Wide, sturdy granite foothold. Safe to rest on while timing
                  your next move.
                </Text>
              </View>
            </View>

            {/* 2. Icy Slippery Hold */}
            <View style={styles.guideRow}>
              <View style={styles.previewStage}>
                <SnowyIceHold width={56} slipProgress={0.55} />
              </View>
              <View style={styles.guideTextCol}>
                <Text style={[styles.itemTitle, { color: '#7DD3FC' }]}>
                  Icy Slippery Hold
                </Text>
                <Text style={styles.itemDesc}>
                  Narrower frozen hold! Hop to the next hold within{' '}
                  <Text style={styles.boldWhite}>0.75s</Text> before your grip
                  bar runs out (-20m slide).
                </Text>
              </View>
            </View>

            {/* 3. Falling Boulder */}
            <View style={styles.guideRow}>
              <View style={styles.previewStage}>
                <FallingBoulderMiniature />
              </View>
              <View style={styles.guideTextCol}>
                <Text style={[styles.itemTitle, { color: '#FCA5A5' }]}>
                  Falling Boulder
                </Text>
                <Text style={styles.itemDesc}>
                  When <Text style={styles.boldWhite}>⚠ ROCKFALL</Text> flashes
                  at the top of a lane, a boulder tumbles straight down that
                  lane (-30m & brief stun). Stay in the opposite lane to dodge!
                </Text>
              </View>
            </View>

            {/* 4. Blizzard Gust */}
            <View style={styles.guideRow}>
              <View style={styles.previewStage}>
                <BlizzardGustMiniature />
              </View>
              <View style={styles.guideTextCol}>
                <Text style={[styles.itemTitle, { color: '#BAE6FD' }]}>
                  Blizzard Gust
                </Text>
                <Text style={styles.itemDesc}>
                  Near the Alpine Summit (350–500m), snowstorms sweep across the
                  cliff to obscure vision. No knockback—keep your rhythm!
                </Text>
              </View>
            </View>
          </ScrollView>

          <Pressable
            style={({ pressed }) => [
              styles.gotItBtn,
              pressed && styles.gotItBtnPressed
            ]}
            onPress={onClose}
          >
            <Text style={styles.gotItText}>Got It — Let&apos;s Climb!</Text>
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
  boldWhite: {
    color: '#F8FAFC',
    fontWeight: '900'
  },
  boldGold: {
    color: '#FBBF24',
    fontWeight: '900'
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
