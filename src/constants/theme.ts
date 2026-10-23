/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://unistyl.es/), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#000000',
    background: '#ffffff',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#60646C',
    tint: '#208AEF',
    onTint: '#ffffff',
    success: '#2E9E5B',
    warning: '#C98A00',
    danger: '#D64545',
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
    tint: '#4BA3F5',
    onTint: '#ffffff',
    success: '#4CC57F',
    warning: '#F2B92E',
    danger: '#F06C6C',
  },
} as const;

/** Colors users can pick for categories, projects and their profile. */
export const Palette = [
  '#208AEF',
  '#2E9E5B',
  '#E07A1F',
  '#D64545',
  '#8E5BD6',
  '#D6489B',
  '#1FA6A6',
  '#7A8A99',
] as const;

/** Emoji icons users can pick for categories and projects. */
export const IconChoices = [
  '✅', '🏠', '🧹', '🍽️', '🧺', '🛏️', '🌿', '🐶',
  '💪', '🏃', '🧘', '💤', '💧', '🥗', '📚', '🧠',
  '💼', '💰', '👨‍👩‍👧', '❤️', '🙏', '🚗', '🛠️', '🎨',
] as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
