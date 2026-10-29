import { useState } from 'react';
import { Platform, Switch, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card, ChipGroup, Label, styles } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { showAlert } from '@/lib/dialogs';
import { loadReminders, type Reminders, remindersOn, setReminders } from '@/lib/reminders';

const TIMES = ['07:00', '07:30', '08:00', '09:00', '18:00', '20:00'].map((t) => ({ value: t, label: t }));

/** Settings → Reminders: a morning nudge and a planning-day nudge, scheduled on this phone. */
export function ReminderSettings({ planningDay }: { planningDay: number }) {
  const theme = useTheme();
  const [r, setR] = useState<Reminders>(loadReminders);

  if (Platform.OS === 'web') {
    return (
      <Card>
        <ThemedText type="small" themeColor="textSecondary">
          Reminders work in the iPhone and Android apps.
        </ThemedText>
      </Card>
    );
  }

  const change = async (next: Reminders) => {
    const ok = await setReminders(next, planningDay);
    if (ok) setR(next);
    else
      showAlert(
        'Notifications are off',
        'To get reminders, allow notifications for WhoseTurn in your phone’s settings, then try again.',
      );
  };

  const row = (title: string, detail: string, value: boolean, key: 'morning' | 'planning') => (
    <View style={[styles.row, { justifyContent: 'space-between' }]}>
      <View style={{ flex: 1 }}>
        <ThemedText style={{ fontWeight: 600 }}>{title}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {detail}
        </ThemedText>
      </View>
      <Switch
        value={value}
        onValueChange={(v) => change({ ...r, [key]: v })}
        trackColor={{ true: theme.tint, false: theme.backgroundSelected }}
      />
    </View>
  );

  return (
    <Card style={{ gap: 14 }}>
      {row('Morning reminder', 'Every day: a nudge to check today’s list.', r.morning, 'morning')}
      {row('Planning day reminder', 'On your planning day: time to plan the week.', r.planning, 'planning')}
      {remindersOn(r) && (
        <View style={{ gap: 8 }}>
          <Label>Time</Label>
          <ChipGroup options={TIMES} value={r.time} onChange={(time) => change({ ...r, time })} />
        </View>
      )}
    </Card>
  );
}
