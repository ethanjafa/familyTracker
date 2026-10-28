import { addDays, format, isBefore, isSameDay, startOfDay } from 'date-fns';
import { Pressable, StyleSheet, View } from 'react-native';

import { setMealCook, useMealPlans } from '@/api/meals';
import { type PlanChange, resetWeekToDefaults, setRoutinePlan } from '@/api/plans';
import { planItem, useProjectItems, useProjects } from '@/api/projects';
import { LoadBar } from '@/components/plan/load-bar';
import { ThemedText } from '@/components/themed-text';
import { Avatar, Button, Card, Loading } from '@/components/ui';
import { useRoutineData } from '@/hooks/use-routine-data';
import { useTheme } from '@/hooks/use-theme';
import { toDay } from '@/lib/dates';
import { confirmAsync, showAlert } from '@/lib/dialogs';
import { errorMessage } from '@/lib/errors';
import { sortTodos, todoDay } from '@/lib/projects';
import { assigneesOn, periodStart, plannedOn, usualAssigneesOn, usualDueOn } from '@/lib/schedule';
import type { MealSlot, Member, Routine, RoutineCategory } from '@/lib/types';
import { useHousehold } from '@/providers/household-provider';


/** off = not that day · open = that day, but nobody responsible · owner = someone's on it */
type Cell = { kind: 'off' } | { kind: 'open' } | { kind: 'owner'; userId: string; changed?: boolean };

type Row = {
  key: string;
  /** The category's icon (or 🥪 / 🍽️ for meals), shown before the name. */
  icon: string;
  title: string;
  /** Owned days out of the days needed, e.g. "2/3", shown before the name (none for to-dos). */
  count?: string;
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

  // Routines, in category order (as in Routines & To-dos). Personal ones show with you as the owner.
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
      count: required ? `${owned}/${required}` : undefined,
      // Planned once enough days have an owner for its frequency (3× a week → 3 owned days).
      needs: required ? owned < required : cells.some((c, i) => c.kind === 'open' && upcoming(days[i])),
      cells,
      onPress: (i) => setRoutinePlan(r, keys[i], nextRoutineChange(r, days[i], personal ? me : members)),
      personal,
    };
  };
  const routineRows = data.categories.flatMap((c) =>
    data.routines.filter((r) => r.category_id === c.id).map((r) => routineRow(r, c)),
  );

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
      count: `${cells.filter((c) => c.kind === 'owner').length}/7`,
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
    { key: 'routines', title: 'Routines', rows: routineRows },
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
  const perDay = new Map<string, number[]>(members.map((m) => [m.user_id, days.map(() => 0)]));
  let open = 0;
  for (const row of all.filter((r) => !r.personal)) {
    row.cells.forEach((cell, i) => {
      if (cell.kind === 'owner') {
        counts.set(cell.userId, (counts.get(cell.userId) ?? 0) + 1);
        const day = perDay.get(cell.userId);
        if (day) day[i]++;
      } else if (cell.kind === 'open' && upcoming(days[i])) open++;
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
        {members.length > 1 && <PerPerson days={days} perDay={perDay} />}
      </Card>
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

const CELL = 26;
/** A day is uneven when someone has this many more tasks than someone else. */
const UNEVEN_BY = 2;

/**
 * Per person, per day: how many tasks each family member has, in their colour, with a weekly
 * total. On uneven days the busiest person's number gets an amber outline.
 */
function PerPerson({ days, perDay }: { days: Date[]; perDay: Map<string, number[]> }) {
  const theme = useTheme();
  const { members, memberColor } = useHousehold();
  const dayMax = days.map((_, i) => Math.max(...members.map((m) => perDay.get(m.user_id)?.[i] ?? 0)));
  const dayMin = days.map((_, i) => Math.min(...members.map((m) => perDay.get(m.user_id)?.[i] ?? 0)));
  return (
    <View>
      <ThemedText type="small" themeColor="textSecondary" style={local.section}>
        PER PERSON
      </ThemedText>
      {members.map((m) => {
        const counts = perDay.get(m.user_id) ?? [];
        const color = memberColor(m.user_id);
        const total = counts.reduce((a, b) => a + b, 0);
        return (
          <View key={m.user_id} style={[local.row, { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
            <View style={local.name}>
              <View style={[local.personDot, { backgroundColor: color }]} />
              <ThemedText type="small" style={{ flex: 1, fontWeight: 600 }}>
                {m.profile.display_name.trim().split(/\s+/)[0]} · {total}
              </ThemedText>
            </View>
            <View style={local.cells}>
              {counts.map((n, i) => {
                const uneven = dayMax[i] - dayMin[i] >= UNEVEN_BY && n === dayMax[i];
                return (
                  <View
                    key={i}
                    style={[
                      local.cell,
                      { backgroundColor: n ? `${color}26` : theme.backgroundElement, borderColor: uneven ? theme.warning : 'transparent' },
                    ]}>
                    <ThemedText type="small" style={{ fontWeight: 800, color: n ? color : theme.textSecondary, opacity: n ? 1 : 0.4 }}>
                      {n}
                    </ThemedText>
                  </View>
                );
              })}
            </View>
          </View>
        );
      })}
      <ThemedText type="small" themeColor="textSecondary" style={{ paddingTop: 6 }}>
        Tasks per person each day. An amber outline means that day is uneven.
      </ThemedText>
    </View>
  );
}

function DayHeader({ days }: { days: Date[] }) {
  const theme = useTheme();
  const now = new Date();
  return (
    <View style={local.row}>
      <View style={{ flex: 1 }} />
      <View style={local.cells}>
        {days.map((d) => {
          const color = isSameDay(d, now) ? theme.tint : theme.textSecondary;
          return (
            <View key={d.toISOString()} style={local.dayLabel}>
              <ThemedText style={[local.dayText, { color, fontWeight: 700 }]}>{format(d, 'EEEEE')}</ThemedText>
              <ThemedText style={[local.dayText, { color }]}>{format(d, 'd')}</ThemedText>
            </View>
          );
        })}
      </View>
    </View>
  );
}

/** One compact row: the name on the left (up to two lines), the week's seven boxes on the right. */
function TableRow({ row, days, upcoming }: { row: Row; days: Date[]; upcoming: (d: Date) => boolean }) {
  const theme = useTheme();
  const { memberById } = useHousehold();
  const now = new Date();
  return (
    <View style={[local.row, { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
      <View style={local.name}>
        {/* An amber dot while the row still needs someone; the whole name wraps onto as many lines as it needs. */}
        {row.needs && <View style={[local.needsDot, { backgroundColor: theme.warning }]} />}
        <ThemedText type="small" style={{ flex: 1, fontWeight: 600, lineHeight: 17 }}>
          {row.personal ? '🔒 ' : ''}
          {row.title}
        </ThemedText>
        {row.owner && <Avatar profile={memberById.get(row.owner)?.profile} size={18} />}
      </View>
      <View style={local.cells}>
        {row.cells.map((cell, i) => (
          <Pressable
            key={i}
            onPress={() => row.onPress(i)}
            hitSlop={2}
            style={({ pressed }) => [
              local.cell,
              {
                backgroundColor: cell.kind === 'open' && upcoming(days[i]) ? `${theme.warning}2E` : theme.backgroundElement,
                borderColor: isSameDay(days[i], now) ? theme.tint : 'transparent',
                opacity: pressed ? 0.5 : upcoming(days[i]) ? 1 : 0.45,
              },
            ]}>
            {cell.kind === 'owner' && <Avatar profile={memberById.get(cell.userId)?.profile} size={22} />}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const local = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 5 },
  name: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5 },
  cells: { flexDirection: 'row', gap: 2 },
  dayLabel: { width: CELL, alignItems: 'center' },
  dayText: { fontSize: 11, lineHeight: 13 },
  cell: { width: CELL, height: CELL, borderRadius: 8, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  personDot: { width: 10, height: 10, borderRadius: 5 },
  needsDot: { width: 7, height: 7, borderRadius: 4 },
  section: { fontWeight: 700, fontSize: 11, letterSpacing: 0.6, paddingTop: 12, paddingBottom: 2 },
});
