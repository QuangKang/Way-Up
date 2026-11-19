import * as Crypto from 'expo-crypto';
import { DeviceIdentity } from '@climb/shared';
import { getDatabase } from './sqlite';

interface DeviceIdentityRow {
  id: string;
  guest_uuid: string;
  nickname: string;
  created_at: number;
  last_active_at: number;
}

/**
 * Generates an RFC 4122 compliant UUIDv4.
 * Uses expo-crypto with a fallback implementation.
 */
export function generateUUIDv4(): string {
  try {
    if (typeof Crypto.randomUUID === 'function') {
      return Crypto.randomUUID();
    }
  } catch {
    // Continue to fallback
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Retrieves the local device guest identity or generates and persists a new UUIDv4 identity.
 */
export async function getOrCreateDeviceIdentity(
  suggestedNickname?: string
): Promise<DeviceIdentity> {
  const db = await getDatabase();

  const existing = await db.getFirstAsync<DeviceIdentityRow>(
    'SELECT * FROM device_identity LIMIT 1;'
  );

  const now = Date.now();

  if (existing) {
    // Update last active timestamp
    await db.runAsync(
      'UPDATE device_identity SET last_active_at = ? WHERE id = ?;',
      [now, existing.id]
    );

    return {
      id: existing.id,
      guestUuid: existing.guest_uuid,
      nickname: existing.nickname,
      createdAt: existing.created_at,
      lastActiveAt: now
    };
  }

  // Generate fresh guest identity
  const guestUuid = generateUUIDv4();
  const id = `identity_${guestUuid}`;
  const nickname = suggestedNickname?.trim() || `Climber_${guestUuid.slice(0, 4).toUpperCase()}`;

  await db.runAsync(
    'INSERT INTO device_identity (id, guest_uuid, nickname, created_at, last_active_at) VALUES (?, ?, ?, ?, ?);',
    [id, guestUuid, nickname, now, now]
  );

  return {
    id,
    guestUuid,
    nickname,
    createdAt: now,
    lastActiveAt: now
  };
}

/**
 * Updates the guest player's nickname in SQLite.
 */
export async function updateNickname(newNickname: string): Promise<void> {
  const db = await getDatabase();
  const trimmed = newNickname.trim();
  if (!trimmed) {
    throw new Error('Nickname cannot be empty');
  }

  await db.runAsync(
    'UPDATE device_identity SET nickname = ?, last_active_at = ?;',
    [trimmed, Date.now()]
  );
}
