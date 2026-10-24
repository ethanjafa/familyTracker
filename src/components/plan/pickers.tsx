import { format } from 'date-fns';
import { View } from 'react-native';

import { Chip, styles } from '@/components/ui';
import { toDay } from '@/lib/dates';
import { useHousehold } from '@/providers/household-provider';

export const firstName = (name: string) => name.trim().split(/\s+/)[0];

/** Pick one day of the week, or none (`null`) when `noneLabel` is given. */
export function DayChips({
  days,
  value,
  onChange,
  noneLabel,
}: {
  days: Date[];
  value: string | null | undefined;
  onChange: (day: string | null) => void;
  noneLabel?: string;
}) {
  return (
    <View style={styles.wrap}>
      {days.map((d) => {
        const key = toDay(d);
        return <Chip key={key} label={format(d, 'EEE d')} selected={value === key} onPress={() => onChange(key)} />;
      })}
      {noneLabel && <Chip label={noneLabel} selected={!value} onPress={() => onChange(null)} />}
    </View>
  );
}

/** Pick a family member, or nobody in particular (`null`). */
export function PersonChips({
  value,
  onChange,
  noneLabel = 'Anyone',
  onlyMe = false,
}: {
  value: string | null | undefined;
  onChange: (id: string | null) => void;
  noneLabel?: string;
  onlyMe?: boolean;
}) {
  const { members, userId } = useHousehold();
  const people = onlyMe ? members.filter((m) => m.user_id === userId) : members;
  return (
    <View style={styles.wrap}>
      <Chip label={noneLabel} selected={!value} onPress={() => onChange(null)} />
      {people.map((m) => (
        <Chip
          key={m.user_id}
          label={firstName(m.profile.display_name)}
          selected={value === m.user_id}
          onPress={() => onChange(m.user_id)}
        />
      ))}
    </View>
  );
}
