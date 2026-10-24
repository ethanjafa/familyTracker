import { format, isBefore, isSameDay, startOfDay } from 'date-fns';
import { Pressable, StyleSheet, View } from 'react-native';

import { setMealCook, useMealPlans } from '@/api/meals';
import { type PlanChange, setRoutinePlan } from '@/api/plans';
import { planItem, useProjectItems, useProjects } from '@/api/projects';
import { LoadBar } from '@/components/plan/load-bar';
import { ThemedText } from '@/components/themed-text';
import { Avatar, Card, Loading } from '@/components/ui';
import { Radius } from '@/constants/theme';
import { useRoutineData } from '@/hooks/use-routine-data';
import { useTheme } from '@/hooks/use-theme';
import { toDay, weekStart } from '@/lib/dates';
import { showAlert } from '@/lib/dialogs';
import { errorMessage } from '@/lib/errors';
import { sortItems } from '@/lib/projects';
import { assigneesOn, describeSchedule, isFlexible, plannedOn, usualAssigneesOn, usualDueOn } from '@/lib/schedule';
import type { MealSlot, Member, Routine } from '@/lib/types';
import { useHousehold } from '@/providers/household-provider';

const NAME_WIDTH = 118;
/** Unplanned steps shown per project; the rest stay in Goals. */
const STEPS_PER_PROJECT = 3;

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

/** Each person in turn, then nobody (`null`). */
function nextPerson(current: string | null, members: Member[]): string | null {
  const ids = members.map((m) => m.user_id);
  const i = current ? ids.indexOf(current) : -1;
  return i + 1 < ids.length ? ids[i + 1] : null;
}

/** Plan: one table for the week. Rows are family routines, meals and project steps; tap a box to change who. */
export function PlanTable({ days }: { days: Date[] }) {
  const theme = useTheme();
  const { household, members } = useHousehold();
  const data = useRoutineData();
  const projects = useProjects();
  const items = useProjectItems();
  const mealPlans = useMealPlans();

  if (data.isLoading || projects.isPending || items.isPending) return <Loading />;

  const today = startOfDay(new Date());
  const upcoming = (d: Date) => !isBefore(d, today);
  const keys = days.map(toDay);

  // Routines (family ones; personal routines are always yours).
  const routineRows: Row[] = data.routines
    .filter((r) => data.categoryById.get(r.category_id)?.visibility === 'family')
    .map((r) => {
      const cells: Cell[] = days.map((d) => {
        if (!plannedOn(r, d)) return { kind: 'off' };
        const who = assigneesOn(r, d);
        return who.length ? { kind: 'owner', userId: who[0], changed: r.plans?.has(toDay(d)) } : { kind: 'open' };
      });
      const owned = cells.filter((c) => c.kind === 'owner').length;
      const target = r.schedule.type === 'weekly' ? r.schedule.times : 0;
      const openAhead = cells.some((c, i) => c.kind === 'open' && upcoming(days[i]));
      return {
        key: r.id,
        icon: data.categoryById.get(r.category_id)!.icon,
        title: r.name,
        subtitle: isFlexible(r.schedule) && target ? `${owned}/${target} days` : describeSchedule(r.schedule),
        needs: openAhead || owned < target,
        cells,
        onPress: (i) => setRoutinePlan(r, keys[i], nextRoutineChange(r, days[i], members)),
      };
    });

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

  // Project steps of active family projects: planned this week, or not planned yet.
  const thisWeek = toDay(weekStart(today));
  const stepRows: Row[] = [];
  let hiddenSteps = 0;
  for (const p of (projects.data ?? []).filter((p) => p.status === 'active' && p.visibility === 'family')) {
    const open = sortItems((items.data ?? []).filter((i) => i.project_id === p.id && i.status !== 'done'));
    const planned = open.filter((i) => i.planned_date && keys.includes(i.planned_date));
    // Planned for a past week but not finished counts as not planned.
    const waiting = open.filter((i) => !i.planned_date || i.planned_date < thisWeek);
    hiddenSteps += Math.max(0, waiting.length - STEPS_PER_PROJECT);
    for (const item of [...planned, ...waiting.slice(0, STEPS_PER_PROJECT)]) {
      const day = item.planned_date && keys.includes(item.planned_date) ? item.planned_date : null;
      stepRows.push({
        key: item.id,
        icon: p.icon,
        title: item.title,
        subtitle: p.name,
        needs: !day || !item.assignee_id,
        cells: keys.map((k) =>
          k !== day ? { kind: 'off' } : item.assignee_id ? { kind: 'owner', userId: item.assignee_id } : { kind: 'open' },
        ),
        // Tap another day to move the step there; tap its day to cycle who, then take it off the week.
        onPress: (i) => {
          if (keys[i] !== day) return planItem(item, { planned_date: keys[i] }).catch(fail);
          const ids = members.map((m) => m.user_id);
          const at = item.assignee_id ? ids.indexOf(item.assignee_id) : -1;
          const change = at + 1 < ids.length ? { assignee_id: ids[at + 1] } : { planned_date: null, assignee_id: null };
          return planItem(item, change).catch(fail);
        },
      });
    }
  }

  const sections = [
    { title: 'Routines', rows: routineRows },
    { title: 'Meals', rows: [mealRow('lunch'), mealRow('dinner')] },
    { title: 'Project steps', rows: stepRows },
  ].filter((s) => s.rows.length);
  const all = sections.flatMap((s) => s.rows);
  const needing = all.filter((r) => r.needs).length;

  // Every box with someone in it is one task for that person; empty boxes still ahead are open.
  const counts = new Map<string, number>();
  let open = 0;
  for (const row of all) {
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
          <View key={s.title}>
            <ThemedText type="small" themeColor="textSecondary" style={local.section}>
              {s.title.toUpperCase()}
            </ThemedText>
            {s.rows.map((row) => (
              <TableRow key={row.key} row={row} days={days} upcoming={upcoming} />
            ))}
          </View>
        ))}
        {hiddenSteps > 0 && (
          <ThemedText type="small" themeColor="textSecondary" style={{ paddingVertical: 8, textAlign: 'center' }}>
            + {hiddenSteps} more steps in Goals
          </ThemedText>
        )}
      </Card>
      <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
        Tap a box to change who&apos;s on it · ○ needs someone
      </ThemedText>
      <LoadBar counts={counts} open={open} />
    </>
  );
}

function DayHeader({ days }: { days: Date[] }) {
  const theme = useTheme();
  const now = new Date();
  return (
    <View style={local.row}>
      <View style={{ width: NAME_WIDTH }} />
      {days.map((d) => {
        const color = isSameDay(d, now) ? theme.tint : theme.textSecondary;
        return (
          <View key={d.toISOString()} style={local.cell}>
            <ThemedText type="small" style={{ fontWeight: 700, color }}>
              {format(d, 'EEEEE')}
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

function TableRow({ row, days, upcoming }: { row: Row; days: Date[]; upcoming: (d: Date) => boolean }) {
  const theme = useTheme();
  const { memberById } = useHousehold();
  return (
    <View
      style={[
        local.row,
        { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth },
        row.needs && { backgroundColor: `${theme.warning}14`, borderRadius: Radius.sm },
      ]}>
      <View style={{ width: NAME_WIDTH, paddingHorizontal: 4 }}>
        <ThemedText type="small" numberOfLines={1} style={{ fontWeight: 600 }}>
          {row.needs ? '⚠️ ' : ''}
          {row.title}
        </ThemedText>
        <ThemedText type="small" numberOfLines={1} themeColor="textSecondary" style={{ fontSize: 11, lineHeight: 14 }}>
          {row.icon} {row.subtitle}
        </ThemedText>
      </View>
      {row.cells.map((cell, i) => (
        <Pressable
          key={i}
          onPress={() => row.onPress(i)}
          hitSlop={2}
          style={({ pressed }) => [local.cell, { opacity: pressed ? 0.5 : upcoming(days[i]) ? 1 : 0.45 }]}>
          {cell.kind === 'off' ? (
            <View style={[local.off, { backgroundColor: theme.backgroundSelected }]} />
          ) : cell.kind === 'open' ? (
            <View style={[local.open, { borderColor: row.needs && upcoming(days[i]) ? theme.warning : theme.textSecondary }]} />
          ) : (
            <View style={cell.changed ? [local.ring, { borderColor: theme.tint }] : undefined}>
              <Avatar profile={memberById.get(cell.userId)?.profile} size={22} />
            </View>
          )}
        </Pressable>
      ))}
    </View>
  );
}

const local = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7 },
  cell: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 30 },
  section: { fontWeight: 700, fontSize: 11, letterSpacing: 0.6, paddingTop: 12, paddingBottom: 4, paddingHorizontal: 4 },
  off: { width: 6, height: 6, borderRadius: 3 },
  open: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderStyle: 'dashed' },
  ring: { borderWidth: 2, borderRadius: Radius.pill, padding: 1 },
});
