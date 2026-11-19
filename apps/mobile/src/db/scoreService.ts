import { LocalRecord } from '@climb/shared';
import { getDatabase } from './sqlite';
import { generateUUIDv4 } from './identityService';

interface LocalRecordRow {
  id: string;
  player_id: string;
  score: number;
  height: number;
  seed: number;
  duration_ms: number;
  recorded_at: number;
  sync_status: 'PENDING' | 'SYNCED';
}

export interface SaveRecordInput {
  playerId: string;
  score: number;
  height: number;
  seed: number;
  durationMs: number;
}

export async function saveLocalRecord(input: SaveRecordInput): Promise<LocalRecord> {
  const db = await getDatabase();
  const id = `rec_${generateUUIDv4()}`;
  const now = Date.now();
  const syncStatus: 'PENDING' | 'SYNCED' = 'PENDING';

  await db.runAsync(
    `INSERT INTO local_records (
      id, player_id, score, height, seed, duration_ms, recorded_at, sync_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      id,
      input.playerId,
      Math.round(input.score),
      input.height,
      input.seed,
      input.durationMs,
      now,
      syncStatus
    ]
  );

  return {
    id,
    playerId: input.playerId,
    score: Math.round(input.score),
    height: input.height,
    seed: input.seed,
    durationMs: input.durationMs,
    recordedAt: now,
    syncStatus
  };
}

export async function getBestLocalRecords(limit = 10): Promise<LocalRecord[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<LocalRecordRow>(
    'SELECT * FROM local_records ORDER BY score DESC, height DESC LIMIT ?;',
    [limit]
  );

  return rows.map(mapRowToRecord);
}

export async function getAllLocalRecords(): Promise<LocalRecord[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<LocalRecordRow>(
    'SELECT * FROM local_records ORDER BY recorded_at DESC;'
  );

  return rows.map(mapRowToRecord);
}

export async function getPendingSyncRecords(): Promise<LocalRecord[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<LocalRecordRow>(
    "SELECT * FROM local_records WHERE sync_status = 'PENDING' ORDER BY recorded_at ASC;"
  );

  return rows.map(mapRowToRecord);
}

export async function markRecordsAsSynced(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await getDatabase();
  const placeholders = ids.map(() => '?').join(',');

  await db.runAsync(
    `UPDATE local_records SET sync_status = 'SYNCED' WHERE id IN (${placeholders});`,
    ids
  );
}

function mapRowToRecord(row: LocalRecordRow): LocalRecord {
  return {
    id: row.id,
    playerId: row.player_id,
    score: row.score,
    height: row.height,
    seed: row.seed,
    durationMs: row.duration_ms,
    recordedAt: row.recorded_at,
    syncStatus: row.sync_status
  };
}
