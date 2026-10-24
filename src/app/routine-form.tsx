import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { archiveRoutine, deleteRoutine, saveRoutine } from '@/api/routines';
import { ThemedText } from '@/components/themed-text';
import { Button, Chip, ChipGroup, Field, Label, Loading, Screen, Segmented, styles } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useRoutineData } from '@/hooks/use-routine-data';
import { hasDayAssignees, scheduleWeekdays } from '@/lib/schedule';
import { type RoutineTemplate, routineIdeas } from '@/lib/suggestions';
import type { Routine, Schedule, TimeOfDay } from '@/lib/types';
import { confirmAsync, showAlert } from '@/lib/dialogs';
import { errorMessage } from '@/lib/errors';
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

const firstName = (name: string) => name.trim().split(/\s+/)[0];

const COUNTS =[1, 2, 3, 4, 5, 6].map((n) => ({ value: n, label: `${n}×` }));
const INTERVALS = [2, 3, 4, 5, 7, 14].map((n) => ({ value: n, label: `${n} days` }));

export default function RoutineForm() {
  const params = useLocalSearchParams<{ id?: string; categoryId?: string }>();
  const data = useRoutineData();
  if (data.isLoading) return <Loading />;
  const existing = data.routines.find((r) => r.id === params.id);
  const category = data.categoryById.get(existing?.category_id ?? params.categoryId ?? '');
  if (!category) return <Loading />;
  return (
    <RoutineFormBody
      key={existing?.id ?? 'new'}
      existing={existing}
      categoryId={category.id}
      isFamily={category.visibility === 'family'}
      ideas={(query) => routineIdeas(category, data.routines.filter((r) => r.category_id === category.id), query)}
    />
  );
}

function RoutineFormBody({
  existing,
  categoryId,
  isFamily,
  ideas,
}: {
  existing: Routine | undefined;
  categoryId: string;
  isFamily: boolean;
  ideas: (query: string) => RoutineTemplate[];
}) {
  const { household, members } = useHousehold();
  const [name, setName] = useState(existing?.name ?? '');
  const [schedule, setSchedule] = useState<Schedule>(existing?.schedule ?? { type: 'daily' });
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>(existing?.time_of_day ?? 'anytime');
  const [weight, setWeight] = useState(existing?.weight ?? 2);
  const [assignees, setAssignees] = useState<string[]>(existing?.assignee_ids ?? []);
  const [turns, setTurns] = useState(existing ? hasDayAssignees(existing) : false);
  const [dayAssignees, setDayAssignees] = useState<Partial<Record<string, string>>>(existing?.day_assignees ?? {});
  const [busy, setBusy] = useState(false);

  // Taking turns only makes sense for routines tied to weekdays (every day, or certain days).
  const weekdays = scheduleWeekdays(schedule);
  const takingTurns = isFamily && turns && weekdays !== null;
  const setDayAssignee = (day: number, userId: string | null) =>
    setDayAssignees((m) => ({ ...m, [String(day)]: userId ?? undefined }));

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

  const applyIdea = (t: RoutineTemplate) => {
    setName(t.name);
    setSchedule(t.schedule);
    setTimeOfDay(t.time_of_day);
    setWeight(t.weight);
  };
  const nameIdeas = existing ? [] : ideas(name).filter((t) => t.name !== name).slice(0, 6);

  const toggleAssignee = (id: string) =>
    setAssignees((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]));

  const valid = name.trim() && (schedule.type !== 'weekdays' || schedule.days.length > 0);

  const save = async () => {
    setBusy(true);
    const rota = takingTurns
      ? Object.fromEntries(
          Object.entries(dayAssignees).filter(([d, id]) => id && weekdays?.includes(Number(d))),
        )
      : {};
    try {
      await saveRoutine({
        id: existing?.id,
        household_id: household.id,
        category_id: categoryId,
        name: name.trim(),
        schedule,
        time_of_day: timeOfDay,
        weight,
        assignee_ids: takingTurns ? [...new Set(Object.values(rota) as string[])] : isFamily ? assignees : [],
        // Only send the column once it exists (or is needed), so routines still save before the migration runs.
        ...(takingTurns || existing?.day_assignees !== undefined ? { day_assignees: rota } : {}),
      });
      router.back();
    } catch (e) {
      const message = errorMessage(e);
      showAlert(
        'Could not save',
        message.includes('day_assignees')
          ? 'Taking turns needs a quick database update. Run supabase/migrations/20261024000000_day_assignees.sql in the Supabase SQL Editor, then try again.'
          : message,
      );
      setBusy(false);
    }
  };

  const archive = async () => {
    if (!(await confirmAsync('Archive routine?', 'It stops showing up. Past check-ins stay in your history.', 'Archive'))) return;
    try {
      await archiveRoutine(existing!.id);
      router.back();
    } catch (e) {
      showAlert('Could not archive', errorMessage(e));
    }
  };

  const remove = async () => {
    if (!(await confirmAsync('Delete routine?', 'The routine and all of its check-ins will be deleted from every scorecard.'))) return;
    try {
      await deleteRoutine(existing!.id);
      router.back();
    } catch (e) {
      showAlert('Could not delete', errorMessage(e));
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: existing ? 'Edit routine' : 'New routine' }} />
      <Screen>
        <Field label="Name" value={name} onChangeText={setName} placeholder="e.g. Wash dishes" autoFocus={!existing} />
        {nameIdeas.length > 0 && (
          <View style={{ gap: Spacing.two }}>
            <ThemedText type="small" themeColor="textSecondary">
              💡 Suggestions · tap to fill in
            </ThemedText>
            <View style={styles.wrap}>
              {nameIdeas.map((t) => (
                <Chip key={t.name} label={t.name} selected={false} onPress={() => applyIdea(t)} />
              ))}
            </View>
          </View>
        )}

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
            {weekdays !== null && (
              <Segmented
                options={[
                  { value: 'same', label: 'Same every day' },
                  { value: 'turns', label: 'Take turns by day' },
                ]}
                value={takingTurns ? 'turns' : 'same'}
                onChange={(v) => setTurns(v === 'turns')}
              />
            )}
            {takingTurns ? (
              <View style={{ gap: Spacing.three }}>
                {WEEKDAYS.filter((d) => weekdays?.includes(d.value)).map((d) => (
                  <View key={d.value} style={[styles.row, { alignItems: 'flex-start', gap: Spacing.three }]}>
                    <ThemedText type="smallBold" style={{ width: 36, paddingTop: 8 }}>
                      {d.label}
                    </ThemedText>
                    <View style={[styles.wrap, { flex: 1 }]}>
                      <Chip
                        label="Anyone"
                        selected={!dayAssignees[String(d.value)]}
                        onPress={() => setDayAssignee(d.value, null)}
                      />
                      {members.map((m) => (
                        <Chip
                          key={m.user_id}
                          label={firstName(m.profile.display_name)}
                          selected={dayAssignees[String(d.value)] === m.user_id}
                          onPress={() => setDayAssignee(d.value, m.user_id)}
                        />
                      ))}
                    </View>
                  </View>
                ))}
                <ThemedText type="small" themeColor="textSecondary">
                  Each day, the routine shows under that person&apos;s Mine list and counts toward their score.
                </ThemedText>
              </View>
            ) : (
              <>
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
          </>
        )}

        <Button title="Save" onPress={save} loading={busy} disabled={!valid} />
        {existing && <Button title="Archive routine" variant="secondary" onPress={archive} />}
        {existing && <Button title="Delete routine" variant="danger" onPress={remove} />}
      </Screen>
    </>
  );
}
