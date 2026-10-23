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

export function isFixedDueOn(routine: Routine, day: Date): boolean {
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
 * week/month target isn't met yet, or if they were already logged today.
 */
export function isDueToday(routine: Routine, logs: Map<string, RoutineLog> | undefined, day: Date) {
  if (routine.archived_at) return false;
  if (!isFlexible(routine.schedule)) return isFixedDueOn(routine, day);
  if (isBefore(day, fromDay(routine.start_date))) return false;
  if (logs?.has(toDay(day))) return true;
  const done = completedBetween(logs, periodStart(routine.schedule, day), day);
  return done < flexibleTarget(routine.schedule);
}
