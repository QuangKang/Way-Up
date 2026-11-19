import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { LocalRecord } from '@climb/shared';
import { getBestLocalRecords, saveLocalRecord } from '../db/scoreService';
import { HapticsService } from '../haptics/hapticsService';

interface OfflineRecordsViewProps {
  playerId: string;
}

export const OfflineRecordsView: React.FC<OfflineRecordsViewProps> = ({ playerId }) => {
  const [records, setRecords] = useState<LocalRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const loadRecords = async () => {
    try {
      setLoading(true);
      const data = await getBestLocalRecords(5);
      setRecords(data);
    } catch (e) {
      console.warn('Failed loading local SQLite records:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRecords();
  }, []);

  const handleRecordMockRun = async () => {
    try {
      void HapticsService.jump();
      const mockScore = Math.floor(Math.random() * 850) + 150;
      const mockHeight = parseFloat((mockScore * 1.25).toFixed(1));
      const mockSeed = Math.floor(Math.random() * 0xffffffff) >>> 0;
      const mockDuration = Math.floor(Math.random() * 45000) + 15000;

      await saveLocalRecord({
        playerId,
        score: mockScore,
        height: mockHeight,
        seed: mockSeed,
        durationMs: mockDuration
      });

      await HapticsService.victory();
      await loadRecords();
    } catch (err) {
      console.error('Failed saving score to SQLite:', err);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Offline Scores (`local_records`)</Text>
          <Text style={styles.subtitle}>Persistent SQLite Storage via expo-sqlite</Text>
        </View>
        <TouchableOpacity style={styles.smallButton} onPress={handleRecordMockRun}>
          <Text style={styles.smallButtonText}>+ Add Run</Text>
        </TouchableOpacity>
      </View>

      {records.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            {loading ? 'Reading SQLite database...' : 'No offline runs recorded yet.'}
          </Text>
          <Text style={styles.emptySub}>
            Tap "+ Add Run" to record an offline climbing score into SQLite.
          </Text>
        </View>
      ) : (
        <View style={styles.recordList}>
          {records.map((rec, index) => (
            <View key={rec.id} style={styles.recordItem}>
              <View style={styles.rankBadge}>
                <Text style={styles.rankText}>#{index + 1}</Text>
              </View>
              <View style={styles.recordDetails}>
                <Text style={styles.scoreText}>{rec.score} pts</Text>
                <Text style={styles.recordMeta}>
                  Height: {rec.height}m • Seed: {rec.seed.toString(16).toUpperCase()}
                </Text>
              </View>
              <View style={styles.syncBadge}>
                <Text style={styles.syncText}>{rec.syncStatus}</Text>
              </View>
            </View>
          ))}
        </View>
      )}
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
    marginBottom: 16
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC'
  },
  subtitle: {
    fontSize: 12,
    color: '#64748B'
  },
  smallButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8
  },
  smallButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12
  },
  emptyContainer: {
    paddingVertical: 20,
    alignItems: 'center'
  },
  emptyText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '600'
  },
  emptySub: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center'
  },
  recordList: {
    gap: 8
  },
  recordItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    padding: 12,
    borderRadius: 10
  },
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12
  },
  rankText: {
    color: '#F8FAFC',
    fontWeight: '800',
    fontSize: 13
  },
  recordDetails: {
    flex: 1
  },
  scoreText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#38BDF8'
  },
  recordMeta: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2
  },
  syncBadge: {
    backgroundColor: '#064E3B',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4
  },
  syncText: {
    color: '#34D399',
    fontSize: 10,
    fontWeight: '700'
  }
});
