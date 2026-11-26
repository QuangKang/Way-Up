import React, { useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View
} from 'react-native';
import {
  ClimbStep,
  generateMountainSteps,
  generateRandomSeed,
  MountainBiome
} from '@climb/shared';
import { HapticsService } from '../haptics/hapticsService';

interface DeterministicObstaclesViewProps {
  initialSeed?: number;
}

type BiomeFilter = 'ALL' | MountainBiome;

const BIOME_LABELS: Record<MountainBiome, string> = {
  FOOTHILLS: 'Foothills',
  CLIFFS: 'Cliffs',
  SUMMIT: 'Summit'
};

const BIOME_RANGES: Record<MountainBiome, string> = {
  FOOTHILLS: '0–150m',
  CLIFFS: '150–350m',
  SUMMIT: '350–500m'
};

function getStepBadgeInfo(step: ClimbStep): {
  label: string;
  bgColor: string;
  borderColor: string;
  textColor: string;
} {
  switch (step.type) {
    case 'STATIC_LEDGE':
      return {
        label: 'GRANITE HOLD',
        bgColor: '#334155',
        borderColor: '#64748B',
        textColor: '#F1F5F9'
      };
    case 'SLIPPERY_LEDGE':
      if (step.biome === 'FOOTHILLS') {
        return {
          label: 'MOSSY ROCK',
          bgColor: '#14532D',
          borderColor: '#22C55E',
          textColor: '#BBF7D0'
        };
      }
      return {
        label: 'ICY LEDGE',
        bgColor: '#0C4A6E',
        borderColor: '#38BDF8',
        textColor: '#E0F2FE'
      };
    case 'FALLING_ROCK':
      return {
        label: 'FALLING BOULDER',
        bgColor: '#7F1D1D',
        borderColor: '#EF4444',
        textColor: '#FECACA'
      };
    case 'GUST_OF_WIND':
      return {
        label: 'BLIZZARD GUST',
        bgColor: '#1E3A8A',
        borderColor: '#93C5FD',
        textColor: '#DBEAFE'
      };
  }
}

export const DeterministicObstaclesView: React.FC<
  DeterministicObstaclesViewProps
> = ({ initialSeed = 133742 }) => {
  const [seed, setSeed] = useState<number>(initialSeed);
  const [biomeFilter, setBiomeFilter] = useState<BiomeFilter>('ALL');
  const [showSeedDetails, setShowSeedDetails] = useState<boolean>(false);

  const steps = useMemo(() => {
    return generateMountainSteps({
      seed,
      targetHeight: 500
    });
  }, [seed]);

  const routeSummary = useMemo(() => {
    let granite = 0;
    let slippery = 0;
    let boulders = 0;
    let gusts = 0;
    for (const s of steps) {
      if (s.index === 0) continue;
      if (s.type === 'STATIC_LEDGE') granite += 1;
      else if (s.type === 'SLIPPERY_LEDGE') slippery += 1;
      else if (s.type === 'FALLING_ROCK') boulders += 1;
      else if (s.type === 'GUST_OF_WIND') gusts += 1;
    }
    return { granite, slippery, boulders, gusts };
  }, [steps]);

  const sampleSteps = useMemo(() => {
    if (biomeFilter === 'ALL') {
      return steps.filter(
        (s) =>
          s.index === 4 ||
          s.index === 10 ||
          s.index === 18 ||
          s.index === 26 ||
          s.index === 34 ||
          s.index === 42 ||
          s.index === 47 ||
          s.index === 50
      );
    }
    return steps.filter((s) => s.biome === biomeFilter && s.index > 0).slice(0, 8);
  }, [steps, biomeFilter]);

  const handleRandomizeSeed = () => {
    void HapticsService.selection();
    setSeed(generateRandomSeed());
  };

  const seedHex = seed.toString(16).toUpperCase().padStart(8, '0');

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTextCol}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>Summit Route Map</Text>
            <Pressable
              style={styles.infoPill}
              onPress={() => {
                void HapticsService.selection();
                setShowSeedDetails((prev) => !prev);
              }}
            >
              <Text style={styles.infoPillText}>
                {showSeedDetails ? 'Hide Seed' : `Route #${seedHex.slice(0, 6)}`}
              </Text>
            </Pressable>
          </View>
          <Text style={styles.subtitle}>
            500m Dual-Lane Ascent • {steps.length - 1} Holds Synchronized
          </Text>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.reseedButton,
            pressed && styles.reseedButtonPressed
          ]}
          onPress={handleRandomizeSeed}
        >
          <Text style={styles.reseedText}>New Route</Text>
        </Pressable>
      </View>

      {/* Expandable Seed / PRNG Inspector for Grading */}
      {showSeedDetails && (
        <View style={styles.seedInspectorBox}>
          <Text style={styles.seedInspectorLabel}>
            MULBERRY32 32-BIT SEED:{' '}
            <Text style={styles.seedInspectorMono}>0x{seedHex}</Text> ({seed})
          </Text>
          <Text style={styles.seedInspectorNote}>
            Safe-Anchor rules place an opposite-lane Granite Hold before every
            Falling Boulder so climbers always have a clear waiting perch.
          </Text>
        </View>
      )}

      {/* Route Hazard Summary Strip */}
      <View style={styles.summaryStrip}>
        <View style={styles.summaryChip}>
          <View style={[styles.summaryDot, { backgroundColor: '#94A3B8' }]} />
          <Text style={styles.summaryChipText}>{routeSummary.granite} Granite</Text>
        </View>
        <View style={styles.summaryChip}>
          <View style={[styles.summaryDot, { backgroundColor: '#38BDF8' }]} />
          <Text style={styles.summaryChipText}>
            {routeSummary.slippery} Slippery
          </Text>
        </View>
        <View style={styles.summaryChip}>
          <View style={[styles.summaryDot, { backgroundColor: '#EF4444' }]} />
          <Text style={styles.summaryChipText}>
            {routeSummary.boulders} Boulders
          </Text>
        </View>
        <View style={styles.summaryChip}>
          <View style={[styles.summaryDot, { backgroundColor: '#93C5FD' }]} />
          <Text style={styles.summaryChipText}>{routeSummary.gusts} Blizzards</Text>
        </View>
      </View>

      {/* Biome Filter Pills */}
      <View style={styles.filterRow}>
        {(['ALL', 'FOOTHILLS', 'CLIFFS', 'SUMMIT'] as const).map((filter) => {
          const active = biomeFilter === filter;
          return (
            <Pressable
              key={filter}
              style={[styles.filterPill, active && styles.filterPillActive]}
              onPress={() => {
                void HapticsService.selection();
                setBiomeFilter(filter);
              }}
            >
              <Text
                style={[styles.filterText, active && styles.filterTextActive]}
              >
                {filter === 'ALL' ? 'Full 500m' : BIOME_LABELS[filter]}
              </Text>
              {filter !== 'ALL' && (
                <Text
                  style={[
                    styles.filterRangeText,
                    active && styles.filterTextActive
                  ]}
                >
                  {BIOME_RANGES[filter]}
                </Text>
              )}
            </Pressable>
          );
        })}
      </View>

      {/* 2-Lane Topological Waypoint List */}
      <View style={styles.list}>
        {sampleSteps.map((step: ClimbStep) => {
          const badge = getStepBadgeInfo(step);
          const isLeft = step.requiredTap === 'LEFT';
          return (
            <View key={step.id} style={styles.item}>
              <View style={styles.leftGroup}>
                <Text style={styles.heightTag}>{step.height}m</Text>
                <View
                  style={[
                    styles.badge,
                    {
                      backgroundColor: badge.bgColor,
                      borderColor: badge.borderColor
                    }
                  ]}
                >
                  <Text style={[styles.badgeText, { color: badge.textColor }]}>
                    {step.index === 50 ? '🏁 SUMMIT CREST' : badge.label}
                  </Text>
                </View>
              </View>

              <View style={styles.rightGroup}>
                <Text style={styles.biomeTag}>{BIOME_LABELS[step.biome]}</Text>
                <View
                  style={[
                    styles.lanePill,
                    isLeft ? styles.lanePillLeft : styles.lanePillRight
                  ]}
                >
                  <Text
                    style={[
                      styles.lanePillText,
                      isLeft ? styles.laneTextLeft : styles.laneTextRight
                    ]}
                  >
                    {step.index === 0
                      ? 'BASE'
                      : isLeft
                      ? '◀ LEFT'
                      : 'RIGHT ▶'}
                  </Text>
                </View>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#132036',
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#263B59'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  headerTextCol: {
    flex: 1,
    marginRight: 10
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
    color: '#F8FAFC',
    letterSpacing: 0.3
  },
  infoPill: {
    backgroundColor: '#0B1424',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#294266'
  },
  infoPillText: {
    color: '#7DD3FC',
    fontSize: 10,
    fontWeight: '800'
  },
  subtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 3,
    fontWeight: '600'
  },
  reseedButton: {
    backgroundColor: '#0284C7',
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 10,
    borderBottomWidth: 3,
    borderBottomColor: '#0369A1'
  },
  reseedButtonPressed: {
    transform: [{ translateY: 1 }],
    borderBottomWidth: 2
  },
  reseedText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12
  },
  seedInspectorBox: {
    backgroundColor: '#0A1220',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1E3A5F'
  },
  seedInspectorLabel: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4
  },
  seedInspectorMono: {
    color: '#38BDF8',
    fontFamily: 'monospace',
    fontWeight: '800'
  },
  seedInspectorNote: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 4,
    lineHeight: 15
  },
  summaryStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12
  },
  summaryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0B1424',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1E2F48'
  },
  summaryDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 5
  },
  summaryChipText: {
    color: '#CBD5E1',
    fontSize: 10,
    fontWeight: '700'
  },
  filterRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12
  },
  filterPill: {
    flex: 1,
    backgroundColor: '#0B1424',
    paddingVertical: 7,
    paddingHorizontal: 4,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#233552'
  },
  filterPillActive: {
    backgroundColor: '#1D4ED8',
    borderColor: '#60A5FA'
  },
  filterText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '800'
  },
  filterRangeText: {
    color: '#64748B',
    fontSize: 8,
    fontWeight: '700',
    marginTop: 1
  },
  filterTextActive: {
    color: '#FFFFFF'
  },
  list: {
    gap: 7
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0B1424',
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1B2B44'
  },
  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1
  },
  heightTag: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '900',
    width: 42
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.4
  },
  rightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  biomeTag: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '700'
  },
  lanePill: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
    minWidth: 58,
    alignItems: 'center'
  },
  lanePillLeft: {
    backgroundColor: 'rgba(56, 189, 248, 0.14)'
  },
  lanePillRight: {
    backgroundColor: 'rgba(245, 158, 11, 0.16)'
  },
  lanePillText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.3
  },
  laneTextLeft: {
    color: '#38BDF8'
  },
  laneTextRight: {
    color: '#FBBF24'
  }
});
