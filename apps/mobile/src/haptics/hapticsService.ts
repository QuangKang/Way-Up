import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

let hapticsEnabled = true;

/**
 * Haptic feedback utility providing tactile responses for climbing interactions.
 * Respects the user's SQLite-persisted `hapticsEnabled` preference.
 */
export const HapticsService = {
  setEnabled(enabled: boolean): void {
    hapticsEnabled = enabled;
  },

  isEnabled(): boolean {
    return hapticsEnabled;
  },

  async selection(): Promise<void> {
    if (!hapticsEnabled || Platform.OS === 'web') return;
    try {
      await Haptics.selectionAsync();
    } catch {
      // Graceful fallback on unsupported devices
    }
  },

  async jump(): Promise<void> {
    if (!hapticsEnabled || Platform.OS === 'web') return;
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      // Graceful fallback
    }
  },

  async springBoost(): Promise<void> {
    if (!hapticsEnabled || Platform.OS === 'web') return;
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {
      // Graceful fallback
    }
  },

  async collision(): Promise<void> {
    if (!hapticsEnabled || Platform.OS === 'web') return;
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } catch {
      // Graceful fallback
    }
  },

  async victory(): Promise<void> {
    if (!hapticsEnabled || Platform.OS === 'web') return;
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      // Graceful fallback
    }
  },

  async warning(): Promise<void> {
    if (!hapticsEnabled || Platform.OS === 'web') return;
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } catch {
      // Graceful fallback
    }
  },

  async defeat(): Promise<void> {
    if (!hapticsEnabled || Platform.OS === 'web') return;
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } catch {
      // Graceful fallback
    }
  }
};
