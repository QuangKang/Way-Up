import React, { useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { generateObstaclePattern, Obstacle, ObstacleType } from '@climb/shared';
import { HapticsService } from '../haptics/hapticsService';

interface DeterministicObstaclesViewProps {
  initialSeed?: number;
}

const TYPE_COLORS: Record<ObstacleType, string> = {
  STATIC_LEDGE: '#64748B',
  CRUMBLING_ROCK: '#EA580C',
  MOVING_SPIKE: '#DC2626',
  SPRING_PAD: '#16A34A',
  GUST_OF_WIND: '#0284C7'
};

export const DeterministicObstaclesView: React.FC<DeterministicObstaclesViewProps> = ({
  initialSeed = 133742
}) => {
  const [seed, setSeed] = useState<number>(initialSeed);

  const obstacles = useMemo(() => {
    return generateObstaclePattern({
      seed,
      goalHeight: 400,
      minVerticalGap: 50,
      maxVerticalGap: 75
    });
  }, [seed]);

  const handleRandomizeSeed = () => {
    void HapticsService.springBoost();
    const newSeed = (Math.floor(Math.random() * 0xffffffff) >>> 0);
    setSeed(newSeed);
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Deterministic Mulberry32 PRNG</Text>
          <Text style={styles.subtitle}>
            32-bit Seed: <Text style={styles.seedText}>0x{seed.toString(16).toUpperCase()}</Text> ({seed})
          </Text>
        </View>
        <TouchableOpacity style={styles.reseedButton} onPress={handleRandomizeSeed}>
          <Text style={styles.reseedText}>Reseed</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.notice}>
        All 4 clients sharing this 32-bit seed compute the exact same obstacle sequence:
      </Text>

      <View style={styles.list}>
        {obstacles.slice(0, 6).map((obs: Obstacle) => (
          <View key={obs.id} style={styles.item}>
            <View
              style={[
                styles.badge,
                { backgroundColor: TYPE_COLORS[obs.type] || '#475569' }
              ]}
            >
              <Text style={styles.badgeText}>{obs.type.replace('_', ' ')}</Text>
            </View>
            <Text style={styles.coords}>
              y={obs.y}m | x={obs.x}px | w={obs.width}px
            </Text>
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
    marginBottom: 12
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC'
  },
  subtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2
  },
  seedText: {
    color: '#38BDF8',
    fontWeight: '700'
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
    color: '#64748B',
    marginBottom: 12
  },
  list: {
    gap: 8
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0F172A',
    padding: 10,
    borderRadius: 8
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800'
  },
  coords: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500'
  }
});
