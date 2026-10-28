import { addDays, addMonths, format, isSameDay, isSameMonth, startOfMonth, startOfWeek } from 'date-fns';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { fromDay, toDay } from '@/lib/dates';

const WEEKDAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** A month grid (Monday first). Works the same on iOS, Android and web. */
export function Calendar({ value, onChange }: { value: string; onChange: (day: string) => void }) {
  const theme = useTheme();
  const today = new Date();
  const selected = value ? fromDay(value) : null;
  const [month, setMonth] = useState(() => startOfMonth(selected ?? today));
  const first = startOfWeek(month, { weekStartsOn: 1 });
  // Six rows always fit any month.
  const cells = Array.from({ length: 42 }, (_, i) => addDays(first, i));

  return (
    <View style={{ gap: 6 }}>
      <View style={local.header}>
        <Pressable onPress={() => setMonth((m) => addMonths(m, -1))} hitSlop={12} style={local.arrow}>
          <ThemedText themeColor="tint" style={local.arrowText}>
            ‹
          </ThemedText>
        </Pressable>
        <ThemedText type="smallBold">{format(month, 'MMMM yyyy')}</ThemedText>
        <Pressable onPress={() => setMonth((m) => addMonths(m, 1))} hitSlop={12} style={local.arrow}>
          <ThemedText themeColor="tint" style={local.arrowText}>
            ›
          </ThemedText>
        </Pressable>
      </View>
      <View style={local.week}>
        {WEEKDAY_LETTERS.map((l, i) => (
          <ThemedText key={i} type="small" themeColor="textSecondary" style={local.letter}>
            {l}
          </ThemedText>
        ))}
      </View>
      {[0, 1, 2, 3, 4, 5].map((row) => (
        <View key={row} style={local.week}>
          {cells.slice(row * 7, row * 7 + 7).map((d) => {
            const isSelected = !!selected && isSameDay(d, selected);
            const isToday = isSameDay(d, today);
            const inMonth = isSameMonth(d, month);
            return (
              <Pressable key={d.toISOString()} onPress={() => onChange(toDay(d))} style={local.cell}>
                <View
                  style={[
                    local.day,
                    isSelected && { backgroundColor: theme.tint },
                    !isSelected && isToday && { borderWidth: 1.5, borderColor: theme.tint },
                  ]}>
                  <ThemedText
                    type="small"
                    style={{
                      fontWeight: isSelected || isToday ? 700 : 500,
                      color: isSelected ? theme.onTint : inMonth ? theme.text : theme.textSecondary,
                      opacity: inMonth ? 1 : 0.45,
                    }}>
                    {format(d, 'd')}
                  </ThemedText>
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const local = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  arrow: { width: 36, height: 32, alignItems: 'center', justifyContent: 'center' },
  arrowText: { fontSize: 24, lineHeight: 28 },
  week: { flexDirection: 'row' },
  letter: { flex: 1, textAlign: 'center', fontWeight: 600 },
  cell: { flex: 1, alignItems: 'center', paddingVertical: 2 },
  day: { width: 36, height: 36, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
});
