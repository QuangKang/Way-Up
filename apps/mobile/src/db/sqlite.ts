import * as SQLite from 'expo-sqlite';

const DB_NAME = 'climb_game.db';

let dbInstance: SQLite.SQLiteDatabase | null = null;

/**
 * Initializes and retrieves the singleton SQLite database instance.
 * Automatically runs schema migrations for `device_identity` and `local_records`.
 */
export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) {
    return dbInstance;
  }

  const db = await SQLite.openDatabaseAsync(DB_NAME);

  // Enable WAL mode for high performance concurrency
  await db.execAsync('PRAGMA journal_mode = WAL;');

  // Run schema creation
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS device_identity (
      id TEXT PRIMARY KEY NOT NULL,
      guest_uuid TEXT NOT NULL UNIQUE,
      nickname TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      last_active_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS local_records (
      id TEXT PRIMARY KEY NOT NULL,
      player_id TEXT NOT NULL,
      score INTEGER NOT NULL,
      height REAL NOT NULL,
      seed INTEGER NOT NULL,
      duration_ms INTEGER NOT NULL,
      recorded_at INTEGER NOT NULL,
      sync_status TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_records_score ON local_records(score DESC);
    CREATE INDEX IF NOT EXISTS idx_records_sync ON local_records(sync_status);
  `);

  dbInstance = db;
  return dbInstance;
}
