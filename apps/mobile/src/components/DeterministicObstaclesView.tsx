import React, { useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import {
  ClimbStep,
  generateMountainSteps,
  generateRandomSeed,
  MountainBiome,
  ObstacleType
} from '@climb/shared';
import { HapticsService } from '../haptics/hapticsService';

interface DeterministicObstaclesViewProps {
  initialSeed?: number;
}

type BiomeFilter = 'ALL' | MountainBiome;

const TYPE_COLORS: Record<ObstacleType, string> = {
  STATIC_LEDGE: '#475569',
  CRUMBLING_ROCK: '#EA580C',
  FALLING_ROCK: '#DC2626',
  GUST_OF_WIND: '#0284C7'
};

const TYPE_LABELS: Record<ObstacleType, string> = {
  STATIC_LEDGE: 'GRANITE LEDGE',
  CRUMBLING_ROCK: 'CRUMBLING ROCK',
  FALLING_ROCK: 'FALLING ROCK',
  GUST_OF_WIND: 'GUST OF WIND'
};

const BIOME_LABELS: Record<MountainBiome, string> = {
  FOOTHILLS: '⛰ Foothills',
  CLIFFS: '🏔 Cliffs',
  SUMMIT: '❄ Summit'
};

export const DeterministicObstaclesView: React.FC<
  DeterministicObstaclesViewProps
> = ({ initialSeed = 133742 }) => {
  const [seed, setSeed] = useState<number>(initialSeed);
  const [biomeFilter, setBiomeFilter] = useState<BiomeFilter>('ALL');

  const steps = useMemo(() => {
    return generateMountainSteps({
      seed,
      targetHeight: 500
    });
  }, [seed]);

  const sampleSteps = useMemo(() => {
    if (biomeFilter === 'ALL') {
      // Sample representative steps across Foothills, Cliffs, and Summit
      return steps.filter(
        (s) =>
          s.index === 4 ||
          s.index === 10 ||
          s.index === 20 ||
          s.index === 28 ||
          s.index === 40 ||
          s.index === 46 ||
          s.index === 50
      );
    }
    return steps.filter((s) => s.biome === biomeFilter).slice(0, 7);
  }, [steps, biomeFilter]);

  const handleRandomizeSeed = () => {
    void HapticsService.selection();
    setSeed(generateRandomSeed());
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Alpine Mulberry32 Route PRNG</Text>
          <Text style={styles.subtitle}>
            32-bit Seed:{' '}
            <Text style={styles.seedText}>
              0x{seed.toString(16).toUpperCase()}
            </Text>{' '}
            ({steps.length - 1} steps • 500m)
          </Text>
        </View>
        <TouchableOpacity
          style={styles.reseedButton}
          onPress={handleRandomizeSeed}
        >
          <Text style={styles.reseedText}>Reseed</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.notice}>
        Fair-terrain Safe-Anchor rules guarantee a solid Granite Ledge before
        every Falling Rock or Wind Gust across all 4 clients:
      </Text>

      {/* Biome Filter Pills */}
      <View style={styles.filterRow}>
        {(['ALL', 'FOOTHILLS', 'CLIFFS', 'SUMMIT'] as const).map((filter) => {
          const active = biomeFilter === filter;
          return (
            <TouchableOpacity
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
                {filter === 'ALL' ? 'All 500m' : BIOME_LABELS[filter]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.list}>
        {sampleSteps.map((step: ClimbStep) => (
          <View key={step.id} style={styles.item}>
            <View style={styles.leftGroup}>
              <Text style={styles.heightTag}>{step.height}m</Text>
              <View
                style={[
                  styles.badge,
                  { backgroundColor: TYPE_COLORS[step.type] }
                ]}
              >
                <Text style={styles.badgeText}>{TYPE_LABELS[step.type]}</Text>
              </View>
            </View>

            <View style={styles.rightGroup}>
              <Text style={styles.biomeTag}>{BIOME_LABELS[step.biome]}</Text>
              <Text style={styles.tapDirTag}>
                {step.index === 0
                  ? 'BASE'
                  : step.requiredTap === 'LEFT'
                  ? '◀ L'
                  : 'R ▶'}
              </Text>
            </View>
          </View>
        ))}
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: '#F8FAFC'
  },
  subtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2
  },
  seedText: {
    color: '#38BDF8',
    fontWeight: '700',
    fontFamily: 'monospace'
  },
  reseedButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8
  },
  reseedText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12
  },
  notice: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 12,
    lineHeight: 17
  },
  filterRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12
  },
  filterPill: {
    flex: 1,
    backgroundColor: '#0F172A',
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155'
  },
  filterPillActive: {
    backgroundColor: '#2563EB',
    borderColor: '#60A5FA'
  },
  filterText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700'
  },
  filterTextActive: {
    color: '#FFFFFF'
  },
  list: {
    gap: 8
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0F172A',
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 8
  },
  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  heightTag: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '800',
    fontFamily: 'monospace',
    width: 40
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800'
  },
  rightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  biomeTag: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600'
  },
  tapDirTag: {
    fontSize: 11,
    color: '#38BDF8',
    fontWeight: '800',
    fontFamily: 'monospace',
    width: 34,
    textAlign: 'right'
  }
});
