import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';

import { archiveRoutine, saveRoutine } from '@/api/routines';
import { ThemedText } from '@/components/themed-text';
import { Button, Chip, ChipGroup, Field, Label, Loading, Screen, styles } from '@/components/ui';
import { useRoutineData } from '@/hooks/use-routine-data';
import type { Routine, Schedule, TimeOfDay } from '@/lib/types';
import { useHousehold } from '@/providers/household-provider';

const WEEKDAYS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
];

const COUNTS = [1, 2, 3, 4, 5, 6].map((n) => ({ value: n, label: `${n}×` }));
const INTERVALS = [2, 3, 4, 5, 7, 14].map((n) => ({ value: n, label: `${n} days` }));

export default function RoutineForm() {
  const params = useLocalSearchParams<{ id?: string; categoryId?: string }>();
  const data = useRoutineData();
  if (data.isLoading) return <Loading />;
  const existing = data.routines.find((r) => r.id === params.id);
  const category = data.categoryById.get(existing?.category_id ?? params.categoryId ?? '');
  if (!category) return <Loading />;
  return <RoutineFormBody key={existing?.id ?? 'new'} existing={existing} categoryId={category.id} isFamily={category.visibility === 'family'} />;
}

function RoutineFormBody({
  existing,
  categoryId,
  isFamily,
}: {
  existing: Routine | undefined;
  categoryId: string;
  isFamily: boolean;
}) {
  const { household, members } = useHousehold();
  const [name, setName] = useState(existing?.name ?? '');
  const [schedule, setSchedule] = useState<Schedule>(existing?.schedule ?? { type: 'daily' });
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>(existing?.time_of_day ?? 'anytime');
  const [weight, setWeight] = useState(existing?.weight ?? 2);
  const [assignees, setAssignees] = useState<string[]>(existing?.assignee_ids ?? []);
  const [busy, setBusy] = useState(false);

  const setType = (type: Schedule['type']) => {
    if (type === schedule.type) return;
    if (type === 'daily') setSchedule({ type });
    if (type === 'weekdays') setSchedule({ type, days: [1, 2, 3, 4, 5] });
    if (type === 'weekly') setSchedule({ type, times: 3 });
    if (type === 'monthly') setSchedule({ type, times: 2 });
    if (type === 'interval') setSchedule({ type, every: 3 });
  };

  const toggleDay = (d: number) => {
    if (schedule.type !== 'weekdays') return;
    const days = schedule.days.includes(d) ? schedule.days.filter((x) => x !== d) : [...schedule.days, d];
    setSchedule({ type: 'weekdays', days });
  };

  const toggleAssignee = (id: string) =>
    setAssignees((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]));

  const valid = name.trim() && (schedule.type !== 'weekdays' || schedule.days.length > 0);

  const save = async () => {
    setBusy(true);
    try {
      await saveRoutine({
        id: existing?.id,
        household_id: household.id,
        category_id: categoryId,
        name: name.trim(),
        schedule,
        time_of_day: timeOfDay,
        weight,
        assignee_ids: isFamily ? assignees : [],
      });
      router.back();
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  const archive = () =>
    Alert.alert('Archive routine?', 'It stops showing up. Past check-ins stay in your history.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Archive',
        style: 'destructive',
        onPress: async () => {
          await archiveRoutine(existing!.id);
          router.back();
        },
      },
    ]);

  return (
    <>
      <Stack.Screen options={{ title: existing ? 'Edit routine' : 'New routine' }} />
      <Screen>
        <Field label="Name" value={name} onChangeText={setName} placeholder="e.g. Wash dishes" autoFocus={!existing} />

        <Label>How often</Label>
        <ChipGroup
          options={[
            { value: 'daily', label: 'Every day' },
            { value: 'weekdays', label: 'Certain days' },
            { value: 'weekly', label: 'Times / week' },
            { value: 'monthly', label: 'Times / month' },
            { value: 'interval', label: 'Every N days' },
          ]}
          value={schedule.type}
          onChange={setType}
        />
        {schedule.type === 'weekdays' && (
          <View style={styles.wrap}>
            {WEEKDAYS.map((d) => (
              <Chip key={d.value} label={d.label} selected={schedule.days.includes(d.value)} onPress={() => toggleDay(d.value)} />
            ))}
          </View>
        )}
        {(schedule.type === 'weekly' || schedule.type === 'monthly') && (
          <ChipGroup options={COUNTS} value={schedule.times} onChange={(times) => setSchedule({ type: schedule.type, times })} />
        )}
        {schedule.type === 'interval' && (
          <ChipGroup options={INTERVALS} value={schedule.every} onChange={(every) => setSchedule({ type: 'interval', every })} />
        )}

        <Label>When</Label>
        <ChipGroup
          options={[
            { value: 'morning', label: '🌅 Morning' },
            { value: 'day', label: '☀️ Day' },
            { value: 'evening', label: '🌙 Evening' },
            { value: 'anytime', label: 'Anytime' },
          ]}
          value={timeOfDay}
          onChange={setTimeOfDay}
        />

        <Label>Importance</Label>
        <ChipGroup
          options={[
            { value: 1, label: 'Nice to have' },
            { value: 2, label: 'Normal' },
            { value: 3, label: 'Must do' },
          ]}
          value={weight}
          onChange={setWeight}
        />
        <ThemedText type="small" themeColor="textSecondary">
          Important routines weigh more in your scorecard.
        </ThemedText>

        {isFamily && (
          <>
            <Label>Responsible</Label>
            <View style={styles.wrap}>
              {members.map((m) => (
                <Chip
                  key={m.user_id}
                  label={m.profile.display_name}
                  selected={assignees.includes(m.user_id)}
                  onPress={() => toggleAssignee(m.user_id)}
                />
              ))}
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              Anyone can check it off. Assigned people get it counted in their personal score.
            </ThemedText>
          </>
        )}

        <Button title="Save" onPress={save} loading={busy} disabled={!valid} />
        {existing && <Button title="Archive routine" variant="danger" onPress={archive} />}
      </Screen>
    </>
  );
}
