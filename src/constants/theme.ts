/**
 * WhoseTurn design tokens: a fresh, clean palette built around the light-green brand colour.
 * Light mode uses a soft mint-white canvas with white cards; dark mode swaps cards for raised greys.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#17201B',
    background: '#F4F8F5',
    backgroundElement: '#EAF1EC',
    backgroundSelected: '#DCE7DF',
    card: '#FFFFFF',
    border: '#E3ECE6',
    textSecondary: '#66736B',
    tint: '#1F9D66',
    tintSoft: '#E1F5EA',
    onTint: '#FFFFFF',
    success: '#22A06B',
    warning: '#E09B00',
    danger: '#E5484D',
  },
  dark: {
    text: '#F2F6F3',
    background: '#0D1210',
    backgroundElement: '#1A211D',
    backgroundSelected: '#27302B',
    card: '#151B18',
    border: '#222B26',
    textSecondary: '#97A49C',
    tint: '#4CD494',
    tintSoft: '#16301F',
    onTint: '#FFFFFF',
    success: '#3DD68C',
    warning: '#FFC53D',
    danger: '#FF6369',
  },
} as const;

/** The brand gradient, matching the app icon. */
export const BrandGradient = ['#9BE8BF', '#34B97A'] as const;

/** Member colours, assigned automatically from each person's id. */
export const Palette = [
  '#1F9D66',
  '#3B82F6',
  '#F59E0B',
  '#EC4899',
  '#8B5CF6',
  '#14B8A6',
  '#EF6C4D',
  '#64748B',
] as const;

/** A stable colour per person, so avatars differ without anyone having to pick one. */
export function colorFor(id: string | undefined) {
  if (!id) return Palette[Palette.length - 1];
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return Palette[hash % Palette.length];
}

/** Emoji icons users can pick for categories and projects. */
export const IconChoices = [
  '✅', '🏠', '🧹', '🍽️', '🧺', '🛏️', '🌿', '🐶',
  '💪', '🏃', '🧘', '💤', '💧', '🥗', '📚', '🧠',
  '💼', '💰', '👨‍👩‍👧', '❤️', '🙏', '🚗', '🛠️', '🎨',
] as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

/**
 * Plus Jakarta Sans, one family per weight: Android ignores `fontWeight` for custom fonts,
 * so ThemedText picks the family from the weight instead.
 */
export const FontFamilies = {
  400: 'PlusJakartaSans_400Regular',
  500: 'PlusJakartaSans_500Medium',
  600: 'PlusJakartaSans_600SemiBold',
  700: 'PlusJakartaSans_700Bold',
  800: 'PlusJakartaSans_800ExtraBold',
} as const;

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

export const Radius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;

/** Soft, layered elevation for cards in light mode; dark mode relies on borders instead. */
export const Shadow = {
  card: '0px 1px 2px rgba(23, 26, 31, 0.04), 0px 6px 16px rgba(23, 26, 31, 0.06)',
  raised: '0px 2px 6px rgba(23, 26, 31, 0.08), 0px 12px 28px rgba(23, 26, 31, 0.10)',
  brand: '0px 10px 24px rgba(31, 157, 102, 0.28)',
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
