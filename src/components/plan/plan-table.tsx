import { addDays, format, isBefore, isSameDay, startOfDay } from 'date-fns';
import { Pressable, StyleSheet, View } from 'react-native';

import { setMealCook, useMealPlans } from '@/api/meals';
import { type PlanChange, resetWeekToDefaults, setRoutinePlan } from '@/api/plans';
import { planItem, useProjectItems, useProjects } from '@/api/projects';
import { LoadBar } from '@/components/plan/load-bar';
import { ThemedText } from '@/components/themed-text';
import { Avatar, Button, Card, Loading, styles } from '@/components/ui';
import { Radius } from '@/constants/theme';
import { useRoutineData } from '@/hooks/use-routine-data';
import { useTheme } from '@/hooks/use-theme';
import { prettyDay, toDay } from '@/lib/dates';
import { confirmAsync, showAlert } from '@/lib/dialogs';
import { errorMessage } from '@/lib/errors';
import { movedFrom, sortTodos, todoDay } from '@/lib/projects';
import { assigneesOn, describeSchedule, periodStart, plannedOn, usualAssigneesOn, usualDueOn } from '@/lib/schedule';
import type { MealSlot, Member, Routine, RoutineCategory } from '@/lib/types';
import { useHousehold } from '@/providers/household-provider';


/** off = not that day · open = that day, but nobody responsible · owner = someone's on it */
type Cell = { kind: 'off' } | { kind: 'open' } | { kind: 'owner'; userId: string; changed?: boolean };

type Row = {
  key: string;
  icon: string;
  title: string;
  subtitle: string;
  /** Not fully planned: a day still needs someone, or too few days have an owner. */
  needs: boolean;
  cells: Cell[];
  onPress: (dayIndex: number) => void;
  /** 🔒 Only you see it; it's yours, and it stays out of the family load bar. */
  personal?: boolean;
  /** Owner shown next to the name when the row has no day this week (to-dos). */
  owner?: string;
};

const fail = (e: unknown) => showAlert('Could not save the plan', errorMessage(e));

/**
 * Routine cells cycle: usual people (or nobody) → each family member → not that day → back.
 * Landing on the usual schedule removes that day's change instead of storing one.
 */
function nextRoutineChange(routine: Routine, day: Date, members: Member[]): PlanChange {
  const usual = usualAssigneesOn(routine, day);
  type Option = { planned: false } | { planned: true; assignee: string | null };
  const options: Option[] = [
    { planned: true, assignee: null },
    ...members.filter((m) => !(usual.length === 1 && usual[0] === m.user_id)).map((m) => ({ planned: true as const, assignee: m.user_id })),
    { planned: false },
  ];
  const plan = routine.plans?.get(toDay(day));
  const current = !plannedOn(routine, day)
    ? options.length - 1
    : plan?.assignee_id
      ? Math.max(0, options.findIndex((o) => o.planned && o.assignee === plan.assignee_id))
      : 0;
  const next = options[(current + 1) % options.length];
  const isUsual = next.planned ? next.assignee === null && usualDueOn(routine, day) : !usualDueOn(routine, day);
  if (isUsual) return null;
  return next.planned ? { planned: true, assignee_id: next.assignee } : { planned: false, assignee_id: null };
}

/**
 * Days with an owner vs. days the frequency asks for. Every day / certain days: the default days
 * this week. Times a week: that number. Times every 2 weeks: that number across the two-week cycle.
 * Older "times a month" routines have no weekly requirement (0).
 */
function routineProgress(routine: Routine, days: Date[]) {
  const s = routine.schedule;
  const span =
    s.type === 'biweekly'
      ? Array.from({ length: 14 }, (_, i) => addDays(periodStart(routine, days[0]), i))
      : days;
  const owned = span.filter((d) => plannedOn(routine, d) && assigneesOn(routine, d).length > 0).length;
  const required =
    s.type === 'weekly' || s.type === 'biweekly' ? s.times : s.type === 'monthly' ? 0 : days.filter((d) => usualDueOn(routine, d)).length;
  return { owned, required };
}

/** Each person in turn, then nobody (`null`). */
function nextPerson(current: string | null, members: Member[]): string | null {
  const ids = members.map((m) => m.user_id);
  const i = current ? ids.indexOf(current) : -1;
  return i + 1 < ids.length ? ids[i + 1] : null;
}

/** Plan: one table for the week. Rows are routines, meals and to-dos; tap a box to change who. */
export function PlanTable({ days }: { days: Date[] }) {
  const theme = useTheme();
  const { household, members, userId } = useHousehold();
  // Personal items can only ever be yours.
  const me = members.filter((m) => m.user_id === userId);
  const data = useRoutineData();
  const projects = useProjects();
  const items = useProjectItems();
  const mealPlans = useMealPlans();

  if (data.isLoading || projects.isPending || items.isPending) return <Loading />;

  const today = startOfDay(new Date());
  const todayKey = toDay(today);
  const upcoming = (d: Date) => !isBefore(d, today);
  const keys = days.map(toDay);

  // Routines: one section per category, in Goals order. Personal ones show with you as the owner.
  const routineRow = (r: Routine, category: RoutineCategory): Row => {
    const personal = !!r.private_to || category.visibility === 'personal';
    const cells: Cell[] = days.map((d) => {
      if (!plannedOn(r, d)) return { kind: 'off' };
      const who = assigneesOn(r, d);
      return who.length ? { kind: 'owner', userId: who[0], changed: r.plans?.has(toDay(d)) } : { kind: 'open' };
    });
    const { owned, required } = routineProgress(r, days);
    return {
      key: r.id,
      icon: category.icon,
      title: r.name,
      subtitle: required ? `${describeSchedule(r.schedule)} · ${owned}/${required}` : describeSchedule(r.schedule),
      // Planned once enough days have an owner for its frequency (3× a week → 3 owned days).
      needs: required ? owned < required : cells.some((c, i) => c.kind === 'open' && upcoming(days[i])),
      cells,
      onPress: (i) => setRoutinePlan(r, keys[i], nextRoutineChange(r, days[i], personal ? me : members)),
      personal,
    };
  };
  const routineSections = data.categories.map((c) => ({
    key: c.id,
    title: `${c.icon} ${c.name}`,
    rows: data.routines.filter((r) => r.category_id === c.id).map((r) => routineRow(r, c)),
  }));

  // Meals: who cooks lunch and dinner each day.
  const mealRow = (slot: MealSlot): Row => {
    const byDay = new Map(
      (mealPlans.data ?? []).filter((p) => p.slot === slot && keys.includes(p.plan_date)).map((p) => [p.plan_date, p]),
    );
    const cells: Cell[] = keys.map((k) => {
      const cook = byDay.get(k)?.cook_id;
      return cook ? { kind: 'owner', userId: cook } : { kind: 'open' };
    });
    return {
      key: slot,
      icon: slot === 'lunch' ? '🥪' : '🍽️',
      title: slot === 'lunch' ? 'Make lunch' : 'Cook dinner',
      subtitle: `${cells.filter((c) => c.kind === 'owner').length}/7 days`,
      needs: cells.some((c, i) => c.kind === 'open' && upcoming(days[i])),
      cells,
      onPress: (i) => {
        const plan = byDay.get(keys[i]);
        setMealCook(household.id, keys[i], slot, nextPerson(plan?.cook_id ?? null, members), plan).catch(fail);
      },
    };
  };

  // To-dos: every open one (except those planned for a later week), so nothing assigned goes missing.
  // A to-do sits on its planned day, or by default on its target date when that falls in this week.
  const todoRows: Row[] = [];
  for (const p of projects.data ?? []) {
    const open = sortTodos((items.data ?? []).filter((i) => i.project_id === p.id && i.status !== 'done'));
    for (const item of open.filter((i) => !i.planned_date || i.planned_date <= keys[6])) {
      const plannedHere = item.planned_date && keys.includes(item.planned_date) ? item.planned_date : null;
      const on = todoDay(item, todayKey);
      const day = on && keys.includes(on) ? on : null;
      const personal = !!item.private_to || p.visibility === 'personal';
      todoRows.push({
        personal,
        key: item.id,
        icon: p.icon,
        title: item.title,
        subtitle: movedFrom(item, todayKey)
          ? `${p.name} · moved from ${prettyDay(movedFrom(item, todayKey)!)}`
          : item.due_date
            ? `${p.name} · ${prettyDay(item.due_date)}`
            : `${p.name} · backlog`,
        // Not on a day this week: show the owner next to the name instead.
        owner: !day ? (item.assignee_id ?? undefined) : undefined,
        // Planned once it has an owner (its day comes from its date, or where it was moved).
        needs: !item.assignee_id,
        cells: keys.map((k) =>
          k !== day ? { kind: 'off' } : item.assignee_id ? { kind: 'owner', userId: item.assignee_id } : { kind: 'open' },
        ),
        // Tap another day to move the to-do there; tap its day to cycle who, then take it off that day.
        onPress: (i) => {
          if (keys[i] !== day) return planItem(item, { planned_date: keys[i] }).catch(fail);
          const ids = (personal ? me : members).map((m) => m.user_id);
          const at = item.assignee_id ? ids.indexOf(item.assignee_id) : -1;
          if (at + 1 < ids.length) return planItem(item, { assignee_id: ids[at + 1] }).catch(fail);
          // The owner stays; only a moved day goes (its own date can't be taken away).
          return planItem(item, plannedHere ? { planned_date: null } : { assignee_id: null }).catch(fail);
        },
      });
    }
  }

  const sections = [
    ...routineSections,
    { key: 'meals', title: 'Meals', rows: [mealRow('lunch'), mealRow('dinner')] },
    { key: 'todos', title: 'To do', rows: todoRows },
  ].filter((s) => s.rows.length);
  const all = sections.flatMap((s) => s.rows);
  const needing = all.filter((r) => r.needs).length;

  // Custom changes for this week: tapped routine boxes and to-dos moved onto a day.
  const changes =
    data.routines.reduce((n, r) => n + keys.filter((k) => r.plans?.has(k)).length, 0) +
    (items.data ?? []).filter((i) => i.planned_date && keys.includes(i.planned_date)).length;
  const backToDefaults = async () => {
    const ok = await confirmAsync(
      'Back to defaults?',
      "This week's custom changes are removed. Every routine goes back to its default days and owners, and moved to-dos go back to their own date.",
      'Back to defaults',
    );
    if (!ok) return;
    try {
      await resetWeekToDefaults(household.id, keys[0], keys[6]);
    } catch (e) {
      showAlert('Could not reset the week', errorMessage(e));
    }
  };

  // Every shared box with someone in it is one task for that person; empty boxes still ahead are open.
  const counts = new Map<string, number>();
  let open = 0;
  for (const row of all.filter((r) => !r.personal)) {
    row.cells.forEach((cell, i) => {
      if (cell.kind === 'owner') counts.set(cell.userId, (counts.get(cell.userId) ?? 0) + 1);
      else if (cell.kind === 'open' && upcoming(days[i])) open++;
    });
  }

  return (
    <>
      <ThemedText type="small" style={{ fontWeight: 700, color: needing ? theme.warning : theme.success }}>
        {needing ? `⚠️ ${needing} of ${all.length} not fully planned yet` : '✅ Everything has someone on it'}
      </ThemedText>
      <Card style={{ gap: 0, paddingVertical: 6, paddingHorizontal: 8 }}>
        <DayHeader days={days} />
        {sections.map((s) => (
          <View key={s.key}>
            <ThemedText type="small" themeColor="textSecondary" style={local.section}>
              {s.title.toUpperCase()}
            </ThemedText>
            {s.rows.map((row) => (
              <TableRow key={row.key} row={row} days={days} upcoming={upcoming} />
            ))}
          </View>
        ))}
      </Card>
      <Legend />
      {changes > 0 && (
        <Button
          title={`↺ Back to defaults (${changes} change${changes === 1 ? '' : 's'})`}
          variant="secondary"
          onPress={backToDefaults}
        />
      )}
      <LoadBar counts={counts} open={open} />
    </>
  );
}

/** What the boxes mean, drawn with the same symbols as the table. */
function Legend() {
  const theme = useTheme();
  const { members, userId, memberById } = useHousehold();
  const me = memberById.get(userId) ?? members[0];
  const items = [
    { symbol: <Avatar profile={me?.profile} size={22} />, text: 'Someone is on it that day' },
    { symbol: <View style={[local.open, { borderColor: theme.warning }]} />, text: 'On that day, but nobody is assigned yet' },
    { symbol: <View style={[local.off, { backgroundColor: theme.backgroundSelected }]} />, text: 'Not on that day' },
    {
      symbol: (
        <View style={[local.ring, { borderColor: theme.tint }]}>
          <Avatar profile={me?.profile} size={18} />
        </View>
      ),
      text: 'Changed for this week only',
    },
  ];
  return (
    <Card style={{ gap: 8 }}>
      <ThemedText type="smallBold">Tap any box to choose who&apos;s on it</ThemedText>
      {items.map((i) => (
        <View key={i.text} style={[styles.row, { gap: 10 }]}>
          <View style={local.legendSymbol}>{i.symbol}</View>
          <ThemedText type="small" themeColor="textSecondary" style={{ flex: 1 }}>
            {i.text}
          </ThemedText>
        </View>
      ))}
    </Card>
  );
}

function DayHeader({ days }: { days: Date[] }) {
  const theme = useTheme();
  const now = new Date();
  return (
    <View style={local.cells}>
      {days.map((d) => {
        const color = isSameDay(d, now) ? theme.tint : theme.textSecondary;
        return (
          <View key={d.toISOString()} style={local.dayLabel}>
            <ThemedText type="small" style={{ fontWeight: 700, color }}>
              {format(d, 'EEE')}
            </ThemedText>
            <ThemedText type="small" style={{ fontSize: 11, lineHeight: 14, color }}>
              {format(d, 'd')}
            </ThemedText>
          </View>
        );
      })}
    </View>
  );
}

/** One task: its full name on top (up to two lines), the week's seven boxes underneath. */
function TableRow({ row, days, upcoming }: { row: Row; days: Date[]; upcoming: (d: Date) => boolean }) {
  const theme = useTheme();
  const { memberById } = useHousehold();
  const now = new Date();
  return (
    <View
      style={[
        local.row,
        { borderTopColor: theme.border },
        row.needs && { backgroundColor: `${theme.warning}14` },
      ]}>
      <View style={local.titleLine}>
        <ThemedText numberOfLines={2} style={{ fontWeight: 600, flex: 1 }}>
          {row.needs ? '⚠️ ' : ''}
          {row.personal ? '🔒 ' : ''}
          {row.title}
        </ThemedText>
        {row.owner && <Avatar profile={memberById.get(row.owner)?.profile} size={22} />}
      </View>
      <ThemedText type="small" numberOfLines={1} themeColor="textSecondary">
        {row.icon} {row.subtitle}
      </ThemedText>
      <View style={local.cells}>
        {row.cells.map((cell, i) => (
          <Pressable
            key={i}
            onPress={() => row.onPress(i)}
            hitSlop={2}
            style={({ pressed }) => [
              local.cell,
              {
                backgroundColor: theme.backgroundElement,
                borderColor: isSameDay(days[i], now) ? theme.tint : 'transparent',
                opacity: pressed ? 0.5 : upcoming(days[i]) ? 1 : 0.45,
              },
            ]}>
            {cell.kind === 'off' ? (
              <View style={[local.off, { backgroundColor: theme.backgroundSelected }]} />
            ) : cell.kind === 'open' ? (
              <View style={[local.open, { borderColor: row.needs && upcoming(days[i]) ? theme.warning : theme.textSecondary }]} />
            ) : (
              <View style={cell.changed ? [local.ring, { borderColor: theme.tint }] : undefined}>
                <Avatar profile={memberById.get(cell.userId)?.profile} size={24} />
              </View>
            )}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const local = StyleSheet.create({
  row: { gap: 4, paddingVertical: 10, paddingHorizontal: 4, borderTopWidth: StyleSheet.hairlineWidth, borderRadius: Radius.sm },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cells: { flexDirection: 'row', gap: 4, marginTop: 4 },
  dayLabel: { flex: 1, alignItems: 'center' },
  cell: { flex: 1, height: 38, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  section: { fontWeight: 700, fontSize: 11, letterSpacing: 0.6, paddingTop: 14, paddingBottom: 2, paddingHorizontal: 4 },
  off: { width: 6, height: 6, borderRadius: 3 },
  open: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderStyle: 'dashed' },
  ring: { borderWidth: 2, borderRadius: Radius.pill, padding: 1 },
  legendSymbol: { width: 32, alignItems: 'center' },
});
