import { addDays, format } from 'date-fns';
import { type PropsWithChildren, type ReactNode, useState } from 'react';
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

import { Calendar } from '@/components/calendar';
import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, FontFamilies, IconChoices, Radius, Shadow, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { fromDay, toDay } from '@/lib/dates';
import { type Band, band } from '@/lib/scoring';
import type { Profile } from '@/lib/types';
import { useHouseholdState } from '@/providers/household-provider';

/** Light mode floats cards on soft shadows; dark mode separates them with borders. */
export function useElevation(level: keyof typeof Shadow = 'card'): ViewStyle {
  const dark = useColorScheme() === 'dark';
  return dark ? {} : { boxShadow: Shadow[level] };
}

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
      refreshControl={
        onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.tint} colors={[theme.tint]} /> : undefined
      }>
      {children}
    </ScrollView>
  );
}

export function Card({ children, style, onPress }: PropsWithChildren<{ style?: ViewStyle; onPress?: () => void }>) {
  const theme = useTheme();
  const elevation = useElevation();
  const body = (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }, elevation, style]}>{children}</View>
  );
  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.985 : 1 }] })}>
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
  const glow = useElevation('brand');
  const bg = variant === 'primary' ? theme.tint : variant === 'danger' ? 'transparent' : theme.tintSoft;
  const fg = variant === 'primary' ? theme.onTint : variant === 'danger' ? theme.danger : theme.tint;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: disabled ? 0.45 : pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
        variant === 'primary' && !disabled && glow,
      ]}>
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon}
          <ThemedText style={{ color: fg, fontWeight: 700 }}>{title}</ThemedText>
        </>
      )}
    </Pressable>
  );
}

export function HeaderButton({ title, onPress }: { title: string; onPress: () => void }) {
  const theme = useTheme();
  const isPlus = title === '+';
  return (
    <Pressable
      onPress={onPress}
      hitSlop={12}
      style={({ pressed }) => [
        isPlus ? [styles.headerPlus, { backgroundColor: theme.tintSoft }] : { paddingHorizontal: Spacing.two },
        { opacity: pressed ? 0.7 : 1 },
      ]}>
      <ThemedText style={{ color: theme.tint, fontWeight: 700, fontSize: isPlus ? 22 : 16, lineHeight: isPlus ? 26 : 22 }}>
        {title}
      </ThemedText>
    </Pressable>
  );
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  const theme = useTheme();
  return (
    <View style={{ gap: Spacing.two }}>
      <Label>{label}</Label>
      <TextInput
        placeholderTextColor={theme.textSecondary}
        selectionColor={theme.tint}
        {...props}
        style={[
          styles.input,
          { backgroundColor: theme.backgroundElement, color: theme.text, fontFamily: FontFamilies[500] },
          props.multiline && { minHeight: 88, textAlignVertical: 'top' },
        ]}
      />
    </View>
  );
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const isValidDay = (s: string) => s === '' || (DATE_RE.test(s) && !isNaN(Date.parse(s)));

/** A date (yyyy-MM-dd) picked from a calendar that opens under the field. Empty string means no date. */
export function DateField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const quick = [
    { label: 'Today', days: 0 },
    { label: 'Tomorrow', days: 1 },
    { label: 'In a week', days: 7 },
  ];
  const pick = (day: string) => {
    onChange(day);
    setOpen(false);
  };
  return (
    <View style={{ gap: Spacing.two }}>
      <Label>{label}</Label>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        style={({ pressed }) => [styles.input, styles.dateButton, { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.8 : 1 }]}>
        <ThemedText style={{ fontWeight: 500, color: value ? theme.text : theme.textSecondary }}>
          📅 {value && isValidDay(value) ? format(fromDay(value), 'EEEE, d MMMM yyyy') : 'Pick a date (optional)'}
        </ThemedText>
        <ThemedText themeColor="textSecondary">{open ? '▾' : '▸'}</ThemedText>
      </Pressable>
      {open && (
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Calendar value={value} onChange={pick} />
        </View>
      )}
      <View style={styles.wrap}>
        {quick.map((q) => (
          <Chip key={q.label} label={q.label} selected={false} onPress={() => pick(toDay(addDays(new Date(), q.days)))} />
        ))}
        {value !== '' && <Chip label="Clear" selected={false} onPress={() => pick('')} />}
      </View>
    </View>
  );
}

export function Label({ children }: PropsWithChildren) {
  return (
    <ThemedText type="small" themeColor="textSecondary" style={{ fontWeight: 600 }}>
      {children}
    </ThemedText>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? theme.tint : theme.card,
          borderColor: selected ? theme.tint : theme.border,
          opacity: pressed ? 0.8 : 1,
        },
      ]}>
      <ThemedText type="small" style={{ color: selected ? theme.onTint : theme.text, fontWeight: selected ? 700 : 500 }}>
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

/** A field that opens a list of options under it. Works the same on iOS, Android and web. */
export function Dropdown<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  return (
    <View style={{ gap: Spacing.two }}>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        style={({ pressed }) => [styles.input, styles.dateButton, { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.8 : 1 }]}>
        <ThemedText style={{ fontWeight: 600 }}>{current?.label ?? 'Choose…'}</ThemedText>
        <ThemedText themeColor="textSecondary">{open ? '▴' : '▾'}</ThemedText>
      </Pressable>
      {open && (
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border, gap: 0, paddingVertical: 4 }]}>
          {options.map((o, i) => {
            const selected = o.value === value;
            return (
              <Pressable
                key={String(o.value)}
                onPress={() => {
                  setOpen(false);
                  if (!selected) onChange(o.value);
                }}
                style={({ pressed }) => [
                  styles.row,
                  { justifyContent: 'space-between', paddingVertical: 12, opacity: pressed ? 0.6 : 1 },
                  i > 0 && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth },
                ]}>
                <ThemedText style={{ fontWeight: selected ? 700 : 500, color: selected ? theme.tint : theme.text }}>{o.label}</ThemedText>
                {selected && <ThemedText themeColor="tint">✓</ThemedText>}
              </Pressable>
            );
          })}
        </View>
      )}
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
  const elevation = useElevation();
  return (
    <View style={[styles.segmented, { backgroundColor: theme.backgroundElement }]}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={[styles.segment, selected && [{ backgroundColor: theme.card }, elevation]]}>
            <ThemedText type="small" style={{ fontWeight: selected ? 700 : 500 }} themeColor={selected ? 'text' : 'textSecondary'}>
              {o.label}
            </ThemedText>
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

export function ProgressBar({ value, color, track }: { value: number; color?: string; track?: string }) {
  const theme = useTheme();
  const bandColor = useBandColor();
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <View style={[styles.track, { backgroundColor: track ?? theme.backgroundElement }]}>
      <View style={[styles.fill, { width: `${clamped}%`, backgroundColor: color ?? bandColor(band(value)) }]} />
    </View>
  );
}

export function ScorePill({ value }: { value: number | null }) {
  const bandColor = useBandColor();
  const color = bandColor(band(value));
  return (
    <View style={[styles.pill, { backgroundColor: `${color}1F` }]}>
      <ThemedText type="smallBold" style={{ color }}>
        {value === null ? '—' : `${value}%`}
      </ThemedText>
    </View>
  );
}

export function Avatar({ profile, size = 28 }: { profile: Profile | undefined; size?: number }) {
  const theme = useTheme();
  const { memberColor } = useHouseholdState();
  const initial = profile?.display_name.trim().charAt(0).toUpperCase() || '?';
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: memberColor(profile?.id),
        borderWidth: size >= 28 ? 2 : 1.5,
        borderColor: theme.card,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <ThemedText style={{ color: '#fff', fontSize: size * 0.42, lineHeight: size * 0.56, fontWeight: 700 }}>
        {initial}
      </ThemedText>
    </View>
  );
}

export function IconTile({ icon, size = 44 }: { icon: string; size?: number }) {
  const theme = useTheme();
  return (
    <View style={[styles.iconTile, { width: size, height: size, borderRadius: size * 0.32, backgroundColor: theme.tintSoft }]}>
      <ThemedText style={{ fontSize: size * 0.48, lineHeight: size * 0.64 }}>{icon}</ThemedText>
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
          style={[
            styles.pickCell,
            {
              backgroundColor: icon === value ? theme.tintSoft : 'transparent',
              borderColor: icon === value ? theme.tint : 'transparent',
            },
          ]}>
          <ThemedText style={{ fontSize: 24, lineHeight: 32 }}>{icon}</ThemedText>
        </Pressable>
      ))}
    </View>
  );
}

export function SectionTitle({ children, right }: PropsWithChildren<{ right?: ReactNode }>) {
  return (
    <View style={styles.sectionTitle}>
      <ThemedText type="heading" style={{ fontSize: 17 }}>
        {children}
      </ThemedText>
      {right}
    </View>
  );
}

export function EmptyState({ icon, title, body, action }: { icon: string; title: string; body: string; action?: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: theme.tintSoft }]}>
        <ThemedText style={{ fontSize: 34, lineHeight: 44 }}>{icon}</ThemedText>
      </View>
      <ThemedText type="heading">{title}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center', maxWidth: 300 }}>
        {body}
      </ThemedText>
      {action && <View style={{ marginTop: Spacing.two, alignSelf: 'stretch' }}>{action}</View>}
    </View>
  );
}

export function Loading() {
  const theme = useTheme();
  return (
    <View style={styles.empty}>
      <ActivityIndicator color={theme.tint} />
    </View>
  );
}

export const styles = StyleSheet.create({
  screen: {
    padding: 20,
    paddingBottom: BottomTabInset + Spacing.five,
    gap: Spacing.three,
  },
  card: {
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
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
    borderRadius: Radius.md,
    minHeight: 52,
    paddingHorizontal: Spacing.four,
  },
  headerPlus: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: 14,
    fontSize: 16,
  },
  dateButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chip: {
    borderRadius: Radius.pill,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  segmented: {
    flexDirection: 'row',
    borderRadius: Radius.md,
    padding: 4,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
    borderRadius: Radius.sm,
  },
  track: {
    height: 8,
    borderRadius: Radius.pill,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: Radius.pill,
  },
  pill: {
    borderRadius: Radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
    minWidth: 54,
    alignItems: 'center',
  },
  iconTile: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickCell: {
    width: 46,
    height: 46,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
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
    paddingVertical: Spacing.five,
    paddingHorizontal: Spacing.four,
  },
  emptyIcon: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.one,
  },
});
