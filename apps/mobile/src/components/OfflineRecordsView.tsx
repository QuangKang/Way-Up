import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LocalRecord } from '@climb/shared';
import { getBestLocalRecords } from '../db/scoreService';

interface OfflineRecordsViewProps {
  playerId: string;
}

export const OfflineRecordsView: React.FC<OfflineRecordsViewProps> = ({
  playerId
}) => {
  const [records, setRecords] = useState<LocalRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadRecords() {
      try {
        setLoading(true);
        const data = await getBestLocalRecords(8);
        if (active) {
          setRecords(data);
        }
      } catch (e) {
        console.warn('Failed loading local records:', e);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }
    void loadRecords();
    return () => {
      active = false;
    };
  }, [playerId]);

  if (records.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyPeakBadge}>
          <Text style={styles.emptyPeakIcon}>🏆</Text>
        </View>
        <Text style={styles.emptyText}>
          {loading ? 'Loading summit records...' : 'No ascents recorded yet'}
        </Text>
        <Text style={styles.emptySub}>
          Complete an Online or Offline race to log your best summit climbs!
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.recordList}>
      {records.map((rec, index) => {
        const rank = index + 1;
        const durationSec =
          rec.durationMs > 0 ? `${(rec.durationMs / 1000).toFixed(2)}s` : '—';

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
                style={[styles.rankText, rank <= 3 && styles.rankTextDark]}
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
                {rec.height >= 500 ? ' • Summit Conquered' : ' • Partial Ascent'}
              </Text>
            </View>

            <View style={styles.altitudeTag}>
              <Text style={styles.altitudeTagText}>
                {rec.height >= 500 ? '🏆 PEAK' : `${Math.round(rec.height)}m`}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  emptyContainer: {
    paddingVertical: 28,
    alignItems: 'center'
  },
  emptyPeakBadge: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#0B1424',
    borderWidth: 1.5,
    borderColor: '#2B456B',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12
  },
  emptyPeakIcon: {
    fontSize: 22
  },
  emptyText: {
    color: '#F1F5F9',
    fontSize: 16,
    fontWeight: '900'
  },
  emptySub: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 5,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 14
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
    borderColor: '#1D314F'
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
  }
});
