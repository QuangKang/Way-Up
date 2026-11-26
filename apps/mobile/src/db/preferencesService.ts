import { CLIMBER_COLORS, isValidClimberColor } from '@climb/shared';
import { getDatabase } from './sqlite';

export type AppLanguage = 'en' | 'vi';

export interface UserPreferences {
  language: AppLanguage;
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  preferredColor: string;
}

interface UserPreferencesRow {
  id: number;
  language: string;
  sound_enabled: number;
  haptics_enabled: number;
  preferred_color: string;
}

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  language: 'en',
  soundEnabled: true,
  hapticsEnabled: true,
  preferredColor: CLIMBER_COLORS[0]
};

function normalizeRow(row: UserPreferencesRow): UserPreferences {
  const language: AppLanguage = row.language === 'vi' ? 'vi' : 'en';
  const preferredColor = isValidClimberColor(row.preferred_color)
    ? row.preferred_color
    : CLIMBER_COLORS[0];

  return {
    language,
    soundEnabled: row.sound_enabled !== 0,
    hapticsEnabled: row.haptics_enabled !== 0,
    preferredColor
  };
}

export async function getOrCreatePreferences(): Promise<UserPreferences> {
  const db = await getDatabase();
  const existing = await db.getFirstAsync<UserPreferencesRow>(
    'SELECT * FROM user_preferences WHERE id = 1 LIMIT 1;'
  );

  if (existing) {
    return normalizeRow(existing);
  }

  await db.runAsync(
    `INSERT OR REPLACE INTO user_preferences (
      id, language, sound_enabled, haptics_enabled, preferred_color
    ) VALUES (1, ?, ?, ?, ?);`,
    [
      DEFAULT_USER_PREFERENCES.language,
      DEFAULT_USER_PREFERENCES.soundEnabled ? 1 : 0,
      DEFAULT_USER_PREFERENCES.hapticsEnabled ? 1 : 0,
      DEFAULT_USER_PREFERENCES.preferredColor
    ]
  );

  return { ...DEFAULT_USER_PREFERENCES };
}

export async function updatePreferences(
  patch: Partial<UserPreferences>
): Promise<UserPreferences> {
  const current = await getOrCreatePreferences();
  const next: UserPreferences = {
    language:
      patch.language === 'en' || patch.language === 'vi'
        ? patch.language
        : current.language,
    soundEnabled:
      typeof patch.soundEnabled === 'boolean'
        ? patch.soundEnabled
        : current.soundEnabled,
    hapticsEnabled:
      typeof patch.hapticsEnabled === 'boolean'
        ? patch.hapticsEnabled
        : current.hapticsEnabled,
    preferredColor:
      patch.preferredColor && isValidClimberColor(patch.preferredColor)
        ? patch.preferredColor
        : current.preferredColor
  };

  const db = await getDatabase();
  await db.runAsync(
    `INSERT OR REPLACE INTO user_preferences (
      id, language, sound_enabled, haptics_enabled, preferred_color
    ) VALUES (1, ?, ?, ?, ?);`,
    [
      next.language,
      next.soundEnabled ? 1 : 0,
      next.hapticsEnabled ? 1 : 0,
      next.preferredColor
    ]
  );

  return next;
}
