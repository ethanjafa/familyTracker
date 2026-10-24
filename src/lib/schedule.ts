import { addDays, differenceInCalendarDays, getDay, isBefore } from 'date-fns';

import { fromDay, monthStart, toDay, weekStart } from '@/lib/dates';
import type { Routine, RoutineLog, Schedule } from '@/lib/types';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function describeSchedule(s: Schedule): string {
  switch (s.type) {
    case 'daily':
      return 'Every day';
    case 'weekdays':
      return [1, 2, 3, 4, 5, 6, 0]
        .filter((d) => s.days.includes(d))
        .map((d) => DAY_NAMES[d])
        .join(', ');
    case 'weekly':
      return `${s.times}× a week`;
    case 'monthly':
      return `${s.times}× a month`;
    case 'interval':
      return s.every === 1 ? 'Every day' : `Every ${s.every} days`;
  }
}

/** Fixed schedules are due on specific days; flexible ones need N completions per week/month. */
export const isFlexible = (s: Schedule) => s.type === 'weekly' || s.type === 'monthly';

/** Weekdays (0 = Sunday) a schedule can fall on, or null when it isn't tied to weekdays. */
export function scheduleWeekdays(s: Schedule): number[] | null {
  if (s.type === 'daily') return [0, 1, 2, 3, 4, 5, 6];
  if (s.type === 'weekdays') return s.days;
  return null;
}

/** Whether a routine takes turns: a different person on different weekdays. */
export const hasDayAssignees = (r: Routine) =>
  scheduleWeekdays(r.schedule) !== null && Object.values(r.day_assignees ?? {}).some(Boolean);

/** Who is usually responsible on a given day, ignoring that week's plan. */
export function usualAssigneesOn(routine: Routine, day: Date): string[] {
  if (!hasDayAssignees(routine)) return routine.assignee_ids;
  const id = routine.day_assignees?.[String(getDay(day))];
  return id ? [id] : [];
}

const planFor = (routine: Routine, day: Date) => routine.plans?.get(toDay(day));

/** Who is responsible for a routine on a given day, including changes made in Plan. */
export function assigneesOn(routine: Routine, day: Date): string[] {
  const plan = planFor(routine, day);
  if (plan?.planned && plan.assignee_id) return [plan.assignee_id];
  return usualAssigneesOn(routine, day);
}

/** The weekdays a person is on duty for a turn-taking routine. */
export function daysAssignedTo(routine: Routine, userId: string): number[] {
  return (scheduleWeekdays(routine.schedule) ?? []).filter((d) => routine.day_assignees?.[String(d)] === userId);
}

/** Whether the regular schedule puts a fixed routine on this day (flexible ones never are). */
export function usualDueOn(routine: Routine, day: Date): boolean {
  const start = fromDay(routine.start_date);
  if (isBefore(day, start)) return false;
  const s = routine.schedule;
  switch (s.type) {
    case 'daily':
      return true;
    case 'weekdays':
      return s.days.includes(getDay(day));
    case 'interval':
      return differenceInCalendarDays(day, start) % Math.max(1, s.every) === 0;
    default:
      return false;
  }
}

/** Whether a routine is on the plan for a day: its usual schedule, unless that day was planned differently. */
export function plannedOn(routine: Routine, day: Date): boolean {
  const plan = planFor(routine, day);
  return plan ? plan.planned : usualDueOn(routine, day);
}

/** Planned that day, and (when narrowed to one person) that person's turn. */
const plannedFor = (routine: Routine, day: Date) =>
  plannedOn(routine, day) && (!routine.scoredFor || assigneesOn(routine, day).includes(routine.scoredFor));

/** Fixed routines: due on planned days. Used for scores and streaks. */
export function isFixedDueOn(routine: Routine, day: Date): boolean {
  return plannedFor(routine, day);
}

/** Whether a flexible routine was placed on any day of the week containing `day`. */
function hasPlacedDays(routine: Routine, day: Date) {
  const start = weekStart(day);
  for (let i = 0; i < 7; i++) if (planFor(routine, addDays(start, i))?.planned) return true;
  return false;
}

export function periodStart(s: Schedule, day: Date): Date {
  return s.type === 'monthly' ? monthStart(day) : weekStart(day);
}

export function flexibleTarget(s: Schedule): number {
  return s.type === 'weekly' || s.type === 'monthly' ? s.times : 1;
}

/** Sum of completion values for a routine from `from` up to and including `to`. */
export function completedBetween(logs: Map<string, RoutineLog> | undefined, from: Date, to: Date) {
  let total = 0;
  if (!logs) return total;
  for (let d = from; !isBefore(to, d); d = addDays(d, 1)) {
    total += logValue(logs.get(toDay(d))) ?? 0;
  }
  return total;
}

/** done = 1, partial = 0.5, skipped = excused (null), missing = 0. */
export function logValue(log: RoutineLog | undefined): number | null {
  if (!log) return 0;
  if (log.status === 'done') return 1;
  if (log.status === 'partial') return 0.5;
  return null;
}

/**
 * Whether a routine belongs on the Today list. Flexible routines show while their
 * week/month target isn't met yet (or on the days they were placed), or if already logged today.
 */
export function isDueToday(routine: Routine, logs: Map<string, RoutineLog> | undefined, day: Date) {
  if (routine.archived_at) return false;
  if (!isFlexible(routine.schedule)) return isFixedDueOn(routine, day);
  if (isBefore(day, fromDay(routine.start_date))) return false;
  if (logs?.has(toDay(day))) return true;
  // Once placed on days in Plan, a flexible routine only shows on those days.
  if (hasPlacedDays(routine, day)) return plannedFor(routine, day);
  const done = completedBetween(logs, periodStart(routine.schedule, day), day);
  return done < flexibleTarget(routine.schedule);
}
