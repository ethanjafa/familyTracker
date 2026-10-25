import { addDays, differenceInCalendarDays, endOfMonth, getDay, getDaysInMonth, isBefore } from 'date-fns';

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
    case 'biweekly':
      return `${s.times}× every 2 weeks`;
    case 'monthly':
      return `${s.times}× a month`;
    case 'interval':
      return s.every === 1 ? 'Every day' : `Every ${s.every} days`;
  }
}

/** Fixed schedules are due on specific days; flexible ones need N completions per period. */
export const isFlexible = (s: Schedule) => s.type === 'weekly' || s.type === 'biweekly' || s.type === 'monthly';

/**
 * Weekdays (0 = Sunday) a schedule falls on by default, or null when it isn't tied to weekdays.
 * Times-a-week routines count once default days are picked.
 */
export function scheduleWeekdays(s: Schedule): number[] | null {
  if (s.type === 'daily') return [0, 1, 2, 3, 4, 5, 6];
  if (s.type === 'weekdays') return s.days;
  if (s.type === 'weekly' && s.days?.length) return s.days;
  return null;
}

/** Day 0–13 of a two-week cycle (0 = Monday of week 1), counted from the routine's start week. */
export function cycleDay(routine: Routine, day: Date) {
  const diff = differenceInCalendarDays(day, weekStart(fromDay(routine.start_date)));
  return ((diff % 14) + 14) % 14;
}

/** The key a day's default owner is stored under: the weekday, or "b<cycle day>" for every-2-weeks routines. */
export const dayKey = (routine: Routine, day: Date) =>
  routine.schedule.type === 'biweekly' ? `b${cycleDay(routine, day)}` : String(getDay(day));

/** Whether a routine has default days. */
const hasDefaultDays = (s: Schedule) => scheduleWeekdays(s) !== null || (s.type === 'biweekly' && !!s.days?.length);

/** Whether a routine has a different person on different days. */
export const hasDayAssignees = (r: Routine) =>
  hasDefaultDays(r.schedule) && Object.values(r.day_assignees ?? {}).some(Boolean);

/** Who is usually responsible on a given day, ignoring that week's plan. */
export function usualAssigneesOn(routine: Routine, day: Date): string[] {
  if (!hasDayAssignees(routine)) return routine.assignee_ids;
  const id = routine.day_assignees?.[dayKey(routine, day)];
  return id ? [id] : [];
}

const planFor = (routine: Routine, day: Date) => routine.plans?.get(toDay(day));

/** Who is responsible for a routine on a given day, including changes made in Plan. */
export function assigneesOn(routine: Routine, day: Date): string[] {
  const plan = planFor(routine, day);
  if (plan?.planned && plan.assignee_id) return [plan.assignee_id];
  return usualAssigneesOn(routine, day);
}

/** Whether someone is a default owner on any day of a routine. */
export const isDayAssignee = (routine: Routine, userId: string) =>
  hasDayAssignees(routine) && Object.values(routine.day_assignees ?? {}).includes(userId);

/** Whether the routine's default schedule puts it on this day. */
export function usualDueOn(routine: Routine, day: Date): boolean {
  const start = fromDay(routine.start_date);
  if (isBefore(day, start)) return false;
  const s = routine.schedule;
  switch (s.type) {
    case 'daily':
      return true;
    case 'weekdays':
      return s.days.includes(getDay(day));
    case 'weekly':
      return !!s.days?.includes(getDay(day));
    case 'biweekly':
      return !!s.days?.includes(cycleDay(routine, day));
    case 'interval':
      return differenceInCalendarDays(day, start) % Math.max(1, s.every) === 0;
    default:
      return false;
  }
}

/** Whether a routine is on the plan for a day: its default schedule, unless that day was planned differently. */
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

/** Start of the period a flexible target is counted over (week, two-week cycle, or month). */
export function periodStart(routine: Routine, day: Date): Date {
  const s = routine.schedule;
  if (s.type === 'monthly') return monthStart(day);
  if (s.type === 'biweekly') return addDays(day, -cycleDay(routine, day));
  return weekStart(day);
}

/** Last day of the period that starts at `start`. */
export function periodEnd(routine: Routine, start: Date): Date {
  const s = routine.schedule;
  if (s.type === 'monthly') return endOfMonth(start);
  return addDays(start, s.type === 'biweekly' ? 13 : 6);
}

export const periodLength = (routine: Routine, start: Date) =>
  routine.schedule.type === 'monthly' ? getDaysInMonth(start) : routine.schedule.type === 'biweekly' ? 14 : 7;

export function flexibleTarget(s: Schedule): number {
  return s.type === 'weekly' || s.type === 'biweekly' || s.type === 'monthly' ? s.times : 1;
}

/** "week", "2 weeks" or "month": the period a flexible target is counted over. */
export const periodName = (s: Schedule) => (s.type === 'monthly' ? 'month' : s.type === 'biweekly' ? '2 weeks' : 'week');

/** Whether a flexible routine is on any day of its current period (by default days or by a plan). */
function hasPlacedDays(routine: Routine, day: Date) {
  const start = periodStart(routine, day);
  const end = periodEnd(routine, start);
  for (let d = start; !isBefore(end, d); d = addDays(d, 1)) if (plannedOn(routine, d)) return true;
  return false;
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
 * Whether a routine belongs on the Today list. Flexible routines show on their days when they
 * have some (default or planned); otherwise while the period's target isn't met. Logged = shown.
 */
export function isDueToday(routine: Routine, logs: Map<string, RoutineLog> | undefined, day: Date) {
  if (routine.archived_at) return false;
  if (!isFlexible(routine.schedule)) return isFixedDueOn(routine, day);
  if (isBefore(day, fromDay(routine.start_date))) return false;
  if (logs?.has(toDay(day))) return true;
  if (hasPlacedDays(routine, day)) return plannedFor(routine, day);
  const done = completedBetween(logs, periodStart(routine, day), day);
  return done < flexibleTarget(routine.schedule);
}
