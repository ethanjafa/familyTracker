import { addDays } from 'date-fns';
import type { PropsWithChildren, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  type TextInputProps,
  View,
  type ViewStyle,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, IconChoices, Palette, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { toDay } from '@/lib/dates';
import { type Band, band } from '@/lib/scoring';
import type { Profile } from '@/lib/types';

export function Screen({
  children,
  onRefresh,
  refreshing = false,
}: PropsWithChildren<{ onRefresh?: () => void; refreshing?: boolean }>) {
  const theme = useTheme();
  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.screen}
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined}>
      {children}
    </ScrollView>
  );
}

export function Card({ children, style, onPress }: PropsWithChildren<{ style?: ViewStyle; onPress?: () => void }>) {
  const theme = useTheme();
  const body = <View style={[styles.card, { backgroundColor: theme.backgroundElement }, style]}>{children}</View>;
  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
      {body}
    </Pressable>
  );
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  icon,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
}) {
  const theme = useTheme();
  const bg = variant === 'primary' ? theme.tint : variant === 'danger' ? 'transparent' : theme.backgroundElement;
  const fg = variant === 'primary' ? theme.onTint : variant === 'danger' ? theme.danger : theme.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.75 : 1 },
      ]}>
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon}
          <ThemedText style={{ color: fg, fontWeight: 600 }}>{title}</ThemedText>
        </>
      )}
    </Pressable>
  );
}

export function HeaderButton({ title, onPress }: { title: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} hitSlop={12} style={{ paddingHorizontal: Spacing.two }}>
      <ThemedText style={{ color: theme.tint, fontWeight: 600, fontSize: title === '+' ? 28 : 16 }}>
        {title}
      </ThemedText>
    </Pressable>
  );
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  const theme = useTheme();
  return (
    <View style={{ gap: Spacing.one }}>
      <Label>{label}</Label>
      <TextInput
        placeholderTextColor={theme.textSecondary}
        {...props}
        style={[
          styles.input,
          { backgroundColor: theme.backgroundElement, color: theme.text },
          props.multiline && { minHeight: 80, textAlignVertical: 'top' },
        ]}
      />
    </View>
  );
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const isValidDay = (s: string) => s === '' || (DATE_RE.test(s) && !isNaN(Date.parse(s)));

/** A yyyy-MM-dd field with quick picks. Empty string means no date. */
export function DateField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const theme = useTheme();
  const quick = [
    { label: 'Today', days: 0 },
    { label: '+1 week', days: 7 },
    { label: '+1 month', days: 30 },
    { label: '+3 months', days: 91 },
  ];
  return (
    <View style={{ gap: Spacing.two }}>
      <Field label={label} value={value} onChangeText={onChange} placeholder="YYYY-MM-DD (optional)" autoCapitalize="none" />
      {!isValidDay(value) && (
        <ThemedText type="small" style={{ color: theme.danger }}>
          Use the format 2026-12-31
        </ThemedText>
      )}
      <View style={styles.wrap}>
        {quick.map((q) => (
          <Chip key={q.label} label={q.label} selected={false} onPress={() => onChange(toDay(addDays(new Date(), q.days)))} />
        ))}
        {value !== '' && <Chip label="Clear" selected={false} onPress={() => onChange('')} />}
      </View>
    </View>
  );
}

export function Label({ children }: PropsWithChildren) {
  return (
    <ThemedText type="smallBold" themeColor="textSecondary" style={{ textTransform: 'uppercase' }}>
      {children}
    </ThemedText>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, { backgroundColor: selected ? theme.tint : theme.backgroundElement }]}>
      <ThemedText type="small" style={{ color: selected ? theme.onTint : theme.text }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

export function ChipGroup<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.wrap}>
      {options.map((o) => (
        <Chip key={String(o.value)} label={o.label} selected={o.value === value} onPress={() => onChange(o.value)} />
      ))}
    </View>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.segmented, { backgroundColor: theme.backgroundElement }]}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={[styles.segment, selected && { backgroundColor: theme.background }]}>
            <ThemedText type={selected ? 'smallBold' : 'small'}>{o.label}</ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

export function useBandColor() {
  const theme = useTheme();
  return (b: Band) =>
    b === 'good' ? theme.success : b === 'ok' ? theme.warning : b === 'bad' ? theme.danger : theme.textSecondary;
}

export function ProgressBar({ value, color }: { value: number; color?: string }) {
  const theme = useTheme();
  const bandColor = useBandColor();
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
      <View style={[styles.fill, { width: `${clamped}%`, backgroundColor: color ?? bandColor(band(value)) }]} />
    </View>
  );
}

export function ScorePill({ value }: { value: number | null }) {
  const bandColor = useBandColor();
  return (
    <View style={[styles.pill, { borderColor: bandColor(band(value)) }]}>
      <ThemedText type="smallBold" style={{ color: bandColor(band(value)) }}>
        {value === null ? '—' : `${value}%`}
      </ThemedText>
    </View>
  );
}

export function Avatar({ profile, size = 28 }: { profile: Profile | undefined; size?: number }) {
  const initial = profile?.display_name.trim().charAt(0).toUpperCase() || '?';
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: profile?.color ?? '#7A8A99',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <ThemedText style={{ color: '#fff', fontSize: size * 0.45, lineHeight: size * 0.6, fontWeight: 700 }}>
        {initial}
      </ThemedText>
    </View>
  );
}

export function IconTile({ icon, color, size = 40 }: { icon: string; color: string; size?: number }) {
  return (
    <View style={[styles.iconTile, { width: size, height: size, backgroundColor: `${color}33` }]}>
      <ThemedText style={{ fontSize: size * 0.5, lineHeight: size * 0.65 }}>{icon}</ThemedText>
    </View>
  );
}

export function IconPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const theme = useTheme();
  return (
    <View style={styles.wrap}>
      {IconChoices.map((icon) => (
        <Pressable
          key={icon}
          onPress={() => onChange(icon)}
          style={[styles.pickCell, { backgroundColor: icon === value ? theme.backgroundSelected : 'transparent' }]}>
          <ThemedText style={{ fontSize: 24, lineHeight: 32 }}>{icon}</ThemedText>
        </Pressable>
      ))}
    </View>
  );
}

export function ColorPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const theme = useTheme();
  return (
    <View style={styles.wrap}>
      {Palette.map((color) => (
        <Pressable
          key={color}
          onPress={() => onChange(color)}
          style={[
            styles.swatch,
            { backgroundColor: color, borderColor: color === value ? theme.text : 'transparent' },
          ]}
        />
      ))}
    </View>
  );
}

export function SectionTitle({ children, right }: PropsWithChildren<{ right?: ReactNode }>) {
  return (
    <View style={styles.sectionTitle}>
      <ThemedText type="smallBold" themeColor="textSecondary" style={{ textTransform: 'uppercase' }}>
        {children}
      </ThemedText>
      {right}
    </View>
  );
}

export function EmptyState({ icon, title, body, action }: { icon: string; title: string; body: string; action?: ReactNode }) {
  return (
    <View style={styles.empty}>
      <ThemedText style={{ fontSize: 44, lineHeight: 56 }}>{icon}</ThemedText>
      <ThemedText type="smallBold" style={{ fontSize: 18 }}>
        {title}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
        {body}
      </ThemedText>
      {action}
    </View>
  );
}

export function Loading() {
  return (
    <View style={styles.empty}>
      <ActivityIndicator />
    </View>
  );
}

export const styles = StyleSheet.create({
  screen: {
    padding: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.five,
    gap: Spacing.three,
  },
  card: {
    borderRadius: 16,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  button: {
    flexDirection: 'row',
    gap: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: Spacing.four,
  },
  input: {
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: 12,
    fontSize: 16,
  },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  segmented: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 3,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 10,
  },
  track: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 4,
  },
  pill: {
    borderWidth: 1.5,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 2,
    minWidth: 54,
    alignItems: 'center',
  },
  iconTile: {
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickCell: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 3,
  },
  sectionTitle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  empty: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.six,
    paddingHorizontal: Spacing.four,
  },
});
