import { Platform, StyleSheet, Text, type TextProps, type TextStyle } from 'react-native';

import { FontFamilies, Fonts, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?: 'default' | 'title' | 'heading' | 'small' | 'smallBold' | 'subtitle' | 'link' | 'linkPrimary' | 'code';
  themeColor?: ThemeColor;
};

/** Custom fonts ship one file per weight, so map the requested weight to the closest family. */
function familyFor(weight: TextStyle['fontWeight']) {
  const n = weight === 'bold' ? 700 : weight === 'normal' || weight === undefined ? 400 : Number(weight);
  const clamped = Math.min(800, Math.max(400, Math.round(n / 100) * 100)) as keyof typeof FontFamilies;
  return FontFamilies[clamped];
}

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();
  const flat: TextStyle = StyleSheet.flatten([styles[type], style]) ?? {};
  const fontFamily = flat.fontFamily ?? familyFor(flat.fontWeight);

  return (
    <Text
      style={[{ color: theme[themeColor ?? 'text'] }, flat, { fontFamily, fontWeight: flat.fontFamily ? flat.fontWeight : undefined }]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  small: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 500,
  },
  smallBold: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 700,
  },
  default: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: 500,
  },
  title: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: 800,
    letterSpacing: -0.6,
  },
  subtitle: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: 700,
    letterSpacing: -0.4,
  },
  heading: {
    fontSize: 19,
    lineHeight: 26,
    fontWeight: 700,
    letterSpacing: -0.2,
  },
  link: {
    lineHeight: 30,
    fontSize: 14,
  },
  linkPrimary: {
    lineHeight: 30,
    fontSize: 14,
    color: '#1F9D66',
  },
  code: {
    fontFamily: Fonts.mono,
    fontWeight: Platform.select({ android: 700 }) ?? 500,
    fontSize: 12,
  },
});
