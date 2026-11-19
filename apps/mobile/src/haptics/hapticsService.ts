import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * Haptic feedback utility providing tactile responses for climbing interactions.
 * Automatically guards against platform-specific or unsupported environments (e.g. Web).
 */
export const HapticsService = {
  /**
   * Subtle tactile tick when touching UI buttons, toggles, or selecting lobby slots.
   */
  async selection(): Promise<void> {
    if (Platform.OS === 'web') return;
    try {
      await Haptics.selectionAsync();
    } catch {
      // Graceful fallback on unsupported devices
    }
  },

  /**
   * Light impact on standard vertical jump or platform landing.
   */
  async jump(): Promise<void> {
    if (Platform.OS === 'web') return;
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      // Graceful fallback
    }
  },

  /**
   * Medium impact on spring pad boost or hitting a moving obstacle.
   */
  async springBoost(): Promise<void> {
    if (Platform.OS === 'web') return;
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {
      // Graceful fallback
    }
  },

  /**
   * Heavy impact on falling or colliding with hazards (e.g. moving spike).
   */
  async collision(): Promise<void> {
    if (Platform.OS === 'web') return;
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } catch {
      // Graceful fallback
    }
  },

  /**
   * Success notification when reaching the top goal or winning a match.
   */
  async victory(): Promise<void> {
    if (Platform.OS === 'web') return;
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      // Graceful fallback
    }
  },

  /**
   * Warning notification when a ledge begins crumbling or countdown ticks.
   */
  async warning(): Promise<void> {
    if (Platform.OS === 'web') return;
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } catch {
      // Graceful fallback
    }
  },

  /**
   * Error notification when falling out of bounds or match is lost.
   */
  async defeat(): Promise<void> {
    if (Platform.OS === 'web') return;
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } catch {
      // Graceful fallback
    }
  }
};
