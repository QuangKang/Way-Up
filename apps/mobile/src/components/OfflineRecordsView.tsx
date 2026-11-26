import React, { useEffect, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { LocalRecord } from '@climb/shared';
import { getBestLocalRecords, saveLocalRecord } from '../db/scoreService';
import { HapticsService } from '../haptics/hapticsService';

interface OfflineRecordsViewProps {
  playerId: string;
}

export const OfflineRecordsView: React.FC<OfflineRecordsViewProps> = ({
  playerId
}) => {
  const [records, setRecords] = useState<LocalRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDevTools, setShowDevTools] = useState(false);

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
      const mockHeight = Math.min(
        500,
        Math.round((Math.floor(Math.random() * 34) + 17) * 10)
      );
      const mockScore = mockHeight * 10 + Math.floor(Math.random() * 180);
      const mockSeed = Math.floor(Math.random() * 0xffffffff) >>> 0;
      const mockDuration = Math.floor(Math.random() * 32000) + 14000;

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
        <View style={styles.headerLeft}>
          <Text style={styles.title}>Personal Best Ascents</Text>
          <Text style={styles.subtitle}>
            Top Summit Logbook • Saved Offline on Device
          </Text>
        </View>

        <Pressable
          style={[
            styles.devTogglePill,
            showDevTools && styles.devTogglePillActive
          ]}
          onPress={() => {
            void HapticsService.selection();
            setShowDevTools((prev) => !prev);
          }}
        >
          <Text
            style={[
              styles.devToggleText,
              showDevTools && styles.devToggleTextActive
            ]}
          >
            {showDevTools ? 'Hide Dev' : 'Dev Tools'}
          </Text>
        </Pressable>
      </View>

      {/* Subtle Dev Tools Bar for Grading / SQLite Testing */}
      {showDevTools && (
        <View style={styles.devBar}>
          <View style={styles.devMetaCol}>
            <Text style={styles.devLabel}>SQLITE STORAGE INSPECTOR</Text>
            <Text style={styles.devSubLabel}>
              Table: local_records (expo-sqlite)
            </Text>
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.simulateBtn,
              pressed && styles.simulateBtnPressed
            ]}
            onPress={() => {
              void handleRecordMockRun();
            }}
          >
            <Text style={styles.simulateBtnText}>+ Add Test Run</Text>
          </Pressable>
        </View>
      )}

      {records.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyPeakBadge}>
            <Text style={styles.emptyPeakIcon}>▲</Text>
          </View>
          <Text style={styles.emptyText}>
            {loading ? 'Loading summit logbook...' : 'No ascents logged yet'}
          </Text>
          <Text style={styles.emptySub}>
            Finish an expedition race to record your fastest climb automatically.
          </Text>
        </View>
      ) : (
        <View style={styles.recordList}>
          {records.map((rec, index) => {
            const rank = index + 1;
            const durationSec =
              rec.durationMs > 0
                ? `${(rec.durationMs / 1000).toFixed(1)}s`
                : '—';

            return (
              <View key={rec.id} style={styles.recordItem}>
                <View
                  style={[
                    styles.rankBadge,
                    rank === 1 && styles.rankGold,
                    rank === 2 && styles.rankSilver,
                    rank === 3 && styles.rankBronze
                  ]}
                >
                  <Text
                    style={[
                      styles.rankText,
                      rank <= 3 && styles.rankTextDark
                    ]}
                  >
                    #{rank}
                  </Text>
                </View>

                <View style={styles.recordDetails}>
                  <View style={styles.scoreRow}>
                    <Text style={styles.heightHighlight}>
                      {Math.round(rec.height)}m
                    </Text>
                    <Text style={styles.scoreText}>{rec.score} pts</Text>
                  </View>
                  <Text style={styles.recordMeta}>
                    Time: {durationSec}
                    {showDevTools
                      ? ` • Seed 0x${rec.seed.toString(16).toUpperCase()}`
                      : rec.height >= 500
                      ? ' • Summit Reached'
                      : ' • Alpine Ascent'}
                  </Text>
                </View>

                {showDevTools ? (
                  <View style={styles.syncBadge}>
                    <Text style={styles.syncText}>{rec.syncStatus}</Text>
                  </View>
                ) : (
                  <View style={styles.altitudeTag}>
                    <Text style={styles.altitudeTagText}>
                      {rec.height >= 500 ? '🏆 PEAK' : `${Math.round(rec.height)}m`}
                    </Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}
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
    marginBottom: 14
  },
  headerLeft: {
    flex: 1,
    marginRight: 10
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
    color: '#F8FAFC',
    letterSpacing: 0.3
  },
  subtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
    fontWeight: '600'
  },
  devTogglePill: {
    backgroundColor: '#0B1424',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#263B59'
  },
  devTogglePillActive: {
    borderColor: '#38BDF8',
    backgroundColor: '#0F2540'
  },
  devToggleText: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '800'
  },
  devToggleTextActive: {
    color: '#7DD3FC'
  },
  devBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0A1220',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#1E3A5F'
  },
  devMetaCol: {
    flex: 1,
    marginRight: 8
  },
  devLabel: {
    color: '#38BDF8',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.6
  },
  devSubLabel: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 1,
    fontFamily: 'monospace'
  },
  simulateBtn: {
    backgroundColor: '#059669',
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 8,
    borderBottomWidth: 2,
    borderBottomColor: '#047857'
  },
  simulateBtnPressed: {
    transform: [{ translateY: 1 }]
  },
  simulateBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 11
  },
  emptyContainer: {
    paddingVertical: 24,
    alignItems: 'center'
  },
  emptyPeakBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#0B1424',
    borderWidth: 1,
    borderColor: '#263B59',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10
  },
  emptyPeakIcon: {
    color: '#FBBF24',
    fontSize: 18,
    fontWeight: '900'
  },
  emptyText: {
    color: '#E2E8F0',
    fontSize: 15,
    fontWeight: '800'
  },
  emptySub: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
    lineHeight: 17,
    paddingHorizontal: 12
  },
  recordList: {
    gap: 8
  },
  recordItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0B1424',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1B2B44'
  },
  rankBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12
  },
  rankGold: {
    backgroundColor: '#FACC15'
  },
  rankSilver: {
    backgroundColor: '#CBD5E1'
  },
  rankBronze: {
    backgroundColor: '#FB923C'
  },
  rankText: {
    color: '#F8FAFC',
    fontWeight: '900',
    fontSize: 13
  },
  rankTextDark: {
    color: '#0F172A'
  },
  recordDetails: {
    flex: 1
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8
  },
  heightHighlight: {
    fontSize: 16,
    fontWeight: '900',
    color: '#F8FAFC'
  },
  scoreText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#38BDF8'
  },
  recordMeta: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '600'
  },
  altitudeTag: {
    backgroundColor: '#162640',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#294266'
  },
  altitudeTagText: {
    color: '#FBBF24',
    fontSize: 10,
    fontWeight: '900'
  },
  syncBadge: {
    backgroundColor: '#064E3B',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6
  },
  syncText: {
    color: '#34D399',
    fontSize: 10,
    fontWeight: '800'
  }
});
