import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { createCategory, deleteRoutine, saveRoutine } from '@/api/routines';
import { CategoryPicker, NEW_CATEGORY } from '@/components/category-picker';
import { ThemedText } from '@/components/themed-text';
import { Button, Chip, ChipGroup, Field, Label, Loading, Screen, Segmented, styles } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useRoutineData } from '@/hooks/use-routine-data';
import { confirmAsync, showAlert } from '@/lib/dialogs';
import { errorMessage } from '@/lib/errors';
import { describeSchedule, hasDayAssignees } from '@/lib/schedule';
import { type RoutineTemplate, routineIdeas } from '@/lib/suggestions';
import type { Routine, Schedule } from '@/lib/types';
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

const COUNTS = [1, 2, 3, 4, 5, 6].map((n) => ({ value: n, label: `${n}×` }));

/** A day the routine falls on by default, with the key its owner is stored under. */
type Slot = { key: string; label: string };

/** Default days of a schedule (none for times-a-week routines without picked days). */
function slotsOf(s: Schedule): Slot[] {
  if (s.type === 'daily') return WEEKDAYS.map((d) => ({ key: String(d.value), label: d.label }));
  if (s.type === 'weekdays' || (s.type === 'weekly' && s.days)) {
    const days = s.type === 'weekdays' ? s.days : s.days!;
    return WEEKDAYS.filter((d) => days.includes(d.value)).map((d) => ({ key: String(d.value), label: d.label }));
  }
  if (s.type === 'biweekly' && s.days) {
    // Cycle days: 0–6 = Mon–Sun of week 1, 7–13 = week 2.
    return [...s.days].sort((a, b) => a - b).map((i) => ({ key: `b${i}`, label: `${WEEKDAYS[i % 7].label} ${i < 7 ? '1' : '2'}` }));
  }
  return [];
}

/** Create or edit a routine in one page: its category is a field (pick one, or type a new one). */
export default function RoutineForm() {
  const params = useLocalSearchParams<{ id?: string; categoryId?: string }>();
  const data = useRoutineData();
  if (data.isLoading) return <Loading />;
  const existing = data.routines.find((r) => r.id === params.id);
  if (params.id && !existing) return <Loading />;
  const initial = existing?.category_id ?? params.categoryId ?? (data.categories.length ? '' : NEW_CATEGORY);
  return <RoutineFormBody key={existing?.id ?? 'new'} existing={existing} initialCategoryId={initial} data={data} />;
}

function RoutineFormBody({
  existing,
  initialCategoryId,
  data,
}: {
  existing: Routine | undefined;
  initialCategoryId: string;
  data: ReturnType<typeof useRoutineData>;
}) {
  const { household, members, userId } = useHousehold();
  const [categoryId, setCategoryId] = useState(initialCategoryId);
  const [newCategory, setNewCategory] = useState('');
  const category = data.categoryById.get(categoryId);
  // Routines in the old personal categories are always personal.
  const lockedPersonal = category?.visibility === 'personal';
  const [personalTag, setPersonal] = useState(!!existing?.private_to);
  const personal = lockedPersonal || personalTag;
  // Personal routines are yours alone, so there's nobody else to share them with.
  const isFamily = !personal;
  const [name, setName] = useState(existing?.name ?? '');
  const [schedule, setSchedule] = useState<Schedule>(existing?.schedule ?? { type: 'daily' });
  const [assignees, setAssignees] = useState<string[]>(existing?.assignee_ids ?? []);
  const [turns, setTurns] = useState(existing ? hasDayAssignees(existing) : false);
  const [dayAssignees, setDayAssignees] = useState<Partial<Record<string, string>>>(existing?.day_assignees ?? {});
  const [busy, setBusy] = useState(false);

  const flexible = schedule.type === 'weekly' || schedule.type === 'biweekly';
  const pickedDays = flexible ? schedule.days : undefined;
  const slots = slotsOf(schedule);
  const perDay = isFamily && turns && slots.length > 0;
  // Older routines may use schedules that are no longer offered; keep them editable as they are.
  const legacy = existing && (existing.schedule.type === 'monthly' || existing.schedule.type === 'interval') ? existing.schedule : null;

  const setType = (type: Schedule['type']) => {
    if (type === schedule.type) return;
    if (type === 'daily') setSchedule({ type });
    if (type === 'weekdays') setSchedule({ type, days: [1, 2, 3, 4, 5] });
    if (type === 'weekly') setSchedule({ type, times: 3 });
    if (type === 'biweekly') setSchedule({ type, times: 1 });
    if ((type === 'monthly' || type === 'interval') && legacy) setSchedule(legacy);
  };

  const toggleDay = (d: number) => {
    if (schedule.type === 'weekdays') {
      setSchedule({ ...schedule, days: schedule.days.includes(d) ? schedule.days.filter((x) => x !== d) : [...schedule.days, d] });
    } else if (flexible) {
      const days = schedule.days ?? [];
      setSchedule({ ...schedule, days: days.includes(d) ? days.filter((x) => x !== d) : [...days, d] });
    }
  };

  const setDefaults = (on: boolean) => {
    if (!flexible) return;
    setSchedule(on ? { ...schedule, days: schedule.days ?? [] } : { type: schedule.type, times: schedule.times });
  };

  const applyIdea = (t: RoutineTemplate) => {
    setName(t.name);
    setSchedule(t.schedule);
  };
  const nameIdeas = existing
    ? []
    : routineIdeas(category, data.routines.filter((r) => r.category_id === categoryId), name)
        .filter((t) => t.name !== name)
        .slice(0, 6);

  const toggleAssignee = (id: string) => setAssignees((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]));
  const setOwner = (key: string, userId: string | null) => setDayAssignees((m) => ({ ...m, [key]: userId ?? undefined }));

  const hasCategory = categoryId === NEW_CATEGORY ? !!newCategory.trim() : !!category;
  const valid =
    name.trim() &&
    hasCategory &&
    (schedule.type !== 'weekdays' || schedule.days.length > 0) &&
    (!pickedDays || pickedDays.length > 0);

  const save = async () => {
    setBusy(true);
    const keys = new Set(slots.map((s) => s.key));
    const rota = perDay ? Object.fromEntries(Object.entries(dayAssignees).filter(([k, id]) => id && keys.has(k))) : {};
    try {
      const category_id = categoryId === NEW_CATEGORY ? await createCategory(household.id, newCategory.trim()) : categoryId;
      await saveRoutine({
        id: existing?.id,
        household_id: household.id,
        category_id,
        name: name.trim(),
        schedule,
        assignee_ids: personal ? [userId] : perDay ? [...new Set(Object.values(rota) as string[])] : assignees,
        // Only send these columns once they exist (or are needed), so routines still save before the migrations run.
        ...(personal || existing?.private_to !== undefined ? { private_to: personal ? userId : null } : {}),
        ...(perDay || existing?.day_assignees !== undefined ? { day_assignees: rota } : {}),
      });
      router.back();
    } catch (e) {
      const message = errorMessage(e);
      showAlert(
        'Could not save',
        message.includes('day_assignees')
          ? 'Owners per day need a quick database update. Run supabase/migrations/20261024000000_day_assignees.sql in the Supabase SQL Editor, then try again.'
          : message,
      );
      setBusy(false);
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

        <CategoryPicker
          categories={data.categories}
          value={categoryId}
          onChange={setCategoryId}
          newName={newCategory}
          onNewName={setNewCategory}
          placeholder="e.g. House cleanliness"
        />
        <Label>Who can see it</Label>
        {lockedPersonal ? (
          <ThemedText type="small" themeColor="textSecondary">
            🔒 Personal. This category is only yours.
          </ThemedText>
        ) : (
          <>
            <Segmented
              options={[
                { value: 'family', label: '👨‍👩‍👧 Family' },
                { value: 'personal', label: '🔒 Personal' },
              ]}
              value={personal ? 'personal' : 'family'}
              onChange={(v) => setPersonal(v === 'personal')}
            />
            <ThemedText type="small" themeColor="textSecondary">
              {personal ? 'Only you can see it, and you are its owner.' : 'Everyone in your household can see it.'}
            </ThemedText>
          </>
        )}

        <Label>How often</Label>
        <ChipGroup
          options={[
            { value: 'daily', label: 'Every day' },
            { value: 'weekdays', label: 'Certain days' },
            { value: 'weekly', label: 'Times / week' },
            { value: 'biweekly', label: 'Times / 2 weeks' },
            ...(legacy ? [{ value: legacy.type, label: describeSchedule(legacy) }] : []),
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
        {flexible && (
          <>
            <ChipGroup options={COUNTS} value={schedule.times} onChange={(times) => setSchedule({ ...schedule, times })} />
            <Label>Default days (optional)</Label>
            <Segmented
              options={[
                { value: 'any', label: 'Any days' },
                { value: 'set', label: 'Set default days' },
              ]}
              value={pickedDays ? 'set' : 'any'}
              onChange={(v) => setDefaults(v === 'set')}
            />
            {pickedDays && schedule.type === 'weekly' && (
              <View style={styles.wrap}>
                {WEEKDAYS.map((d) => (
                  <Chip key={d.value} label={d.label} selected={pickedDays.includes(d.value)} onPress={() => toggleDay(d.value)} />
                ))}
              </View>
            )}
            {pickedDays && schedule.type === 'biweekly' && (
              <View style={{ gap: Spacing.two }}>
                {[0, 7].map((offset) => (
                  <View key={offset} style={[styles.row, { alignItems: 'flex-start', gap: Spacing.two }]}>
                    <ThemedText type="smallBold" style={{ width: 52, paddingTop: 8 }}>
                      Week {offset ? 2 : 1}
                    </ThemedText>
                    <View style={[styles.wrap, { flex: 1 }]}>
                      {WEEKDAYS.map((d, i) => (
                        <Chip key={d.value} label={d.label} selected={pickedDays.includes(offset + i)} onPress={() => toggleDay(offset + i)} />
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            )}
            <ThemedText type="small" themeColor="textSecondary">
              {pickedDays
                ? `${pickedDays.length} of ${schedule.times} picked. Plan uses these days until you change a week.`
                : `Any ${schedule.times} days ${schedule.type === 'weekly' ? 'each week' : 'in two weeks'}. Pick them each week in Plan.`}
            </ThemedText>
          </>
        )}

        {isFamily && (
          <>
            <Label>Owners</Label>
            {slots.length > 0 && (
              <Segmented
                options={[
                  { value: 'same', label: 'Same every day' },
                  { value: 'turns', label: 'Owner per day' },
                ]}
                value={perDay ? 'turns' : 'same'}
                onChange={(v) => setTurns(v === 'turns')}
              />
            )}
            {perDay ? (
              <View style={{ gap: Spacing.three }}>
                {slots.map((slot) => (
                  <View key={slot.key} style={[styles.row, { alignItems: 'flex-start', gap: Spacing.three }]}>
                    <ThemedText type="smallBold" style={{ width: 48, paddingTop: 8 }}>
                      {slot.label}
                    </ThemedText>
                    <View style={[styles.wrap, { flex: 1 }]}>
                      <Chip label="Anyone" selected={!dayAssignees[slot.key]} onPress={() => setOwner(slot.key, null)} />
                      {members.map((m) => (
                        <Chip
                          key={m.user_id}
                          label={firstName(m.profile.display_name)}
                          selected={dayAssignees[slot.key] === m.user_id}
                          onPress={() => setOwner(slot.key, m.user_id)}
                        />
                      ))}
                    </View>
                  </View>
                ))}
                <ThemedText type="small" themeColor="textSecondary">
                  On each day, the routine shows on that person&apos;s Today list and counts toward their score.
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
                  Anyone can check it off. Owners get it counted in their personal score.
                </ThemedText>
              </>
            )}
          </>
        )}

        <Button title="Save" onPress={save} loading={busy} disabled={!valid} />
        {existing && <Button title="Delete routine" variant="danger" onPress={remove} />}
      </Screen>
    </>
  );
}
