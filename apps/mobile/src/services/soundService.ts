import { HapticsService } from '../haptics/hapticsService';

export type SoundCue =
  | 'ui_tap'
  | 'climb_step'
  | 'slip_fall'
  | 'boulder_hit'
  | 'countdown_tick'
  | 'match_go'
  | 'summit_victory';

let soundEnabled = true;

/**
 * Lightweight, non-crashing Sound & Tactile Feedback Service compatible with
 * Expo Go SDK 58 without requiring extra native audio packages (`expo-av` / `expo-audio`).
 * Respects both `soundEnabled` and `hapticsEnabled` SQLite preferences.
 */
export const SoundService = {
  configure(options: { soundEnabled: boolean; hapticsEnabled: boolean }): void {
    soundEnabled = options.soundEnabled;
    HapticsService.setEnabled(options.hapticsEnabled);
  },

  setSoundEnabled(enabled: boolean): void {
    soundEnabled = enabled;
  },

  isSoundEnabled(): boolean {
    return soundEnabled;
  },

  play(cue: SoundCue): void {
    // Safe non-crashing cue dispatch when native audio modules are absent in Expo Go
    if (soundEnabled) {
      // Intentional lightweight cue hook (no-op on native without expo-av)
    }

    switch (cue) {
      case 'ui_tap':
        void HapticsService.selection();
        break;
      case 'climb_step':
        void HapticsService.jump();
        break;
      case 'slip_fall':
        void HapticsService.warning();
        break;
      case 'boulder_hit':
        void HapticsService.collision();
        break;
      case 'countdown_tick':
        void HapticsService.warning();
        break;
      case 'match_go':
        void HapticsService.springBoost();
        break;
      case 'summit_victory':
        void HapticsService.victory();
        break;
    }
  }
};
