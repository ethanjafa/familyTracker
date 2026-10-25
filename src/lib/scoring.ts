import { addDays, differenceInCalendarDays, isAfter, isBefore, max as maxDate, min as minDate, subDays } from 'date-fns';

import { fromDay, toDay } from '@/lib/dates';
import {
  completedBetween,
  flexibleTarget,
  isDayAssignee,
  isFixedDueOn,
  isFlexible,
  logValue,
  periodEnd,
  periodLength,
  periodStart,
} from '@/lib/schedule';
import type { Routine, RoutineCategory, RoutineLog } from '@/lib/types';

/** routine id -> (yyyy-MM-dd -> log) */
export type LogIndex = Map<string, Map<string, RoutineLog>>;

export function indexLogs(logs: RoutineLog[]): LogIndex {
  const index: LogIndex = new Map();
  for (const log of logs) {
    let byDay = index.get(log.routine_id);
    if (!byDay) index.set(log.routine_id, (byDay = new Map()));
    byDay.set(log.log_date, log);
  }
  return index;
}

export type Score = { expected: number; achieved: number };

export const pct = (s: Score): number | null =>
  s.expected > 0 ? Math.round((100 * s.achieved) / s.expected) : null;

const addScores = (a: Score, b: Score): Score => ({
  expected: a.expected + b.expected,
  achieved: a.achieved + b.achieved,
});

/**
 * Weighted completion of one routine over [from, to]. Today only counts against
 * you once logged, so an unfinished day doesn't drag the score down.
 */
export function scoreRoutine(routine: Routine, logs: LogIndex, from: Date, to: Date, now = new Date()): Score {
  const byDay = logs.get(routine.id);
  const start = maxDate([from, fromDay(routine.start_date)]);
  const end = minDate([to, now]);
  const todayKey = toDay(now);
  let expected = 0;
  let achieved = 0;
  if (isAfter(start, end)) return { expected, achieved };

  if (!isFlexible(routine.schedule)) {
    for (let d = start; !isAfter(d, end); d = addDays(d, 1)) {
      if (!isFixedDueOn(routine, d)) continue;
      const key = toDay(d);
      const log = byDay?.get(key);
      if (key === todayKey && !log) continue;
      const value = logValue(log);
      if (value === null) continue;
      expected += 1;
      achieved += value;
    }
  } else {
    // Prorate the weekly/monthly target over the days of each period inside the range.
    const target = flexibleTarget(routine.schedule);
    for (let p = periodStart(routine, start); !isAfter(p, end); ) {
      const last = periodEnd(routine, p);
      const periodDays = periodLength(routine, p);
      const a = maxDate([p, start]);
      const b = minDate([last, end]);
      // Elapsed days exclude today, but today's logs still count.
      const elapsedEnd = toDay(b) === todayKey ? subDays(b, 1) : b;
      const days = Math.max(0, differenceInCalendarDays(elapsedEnd, a) + 1);
      const periodExpected = (target * days) / periodDays;
      const done = completedBetween(byDay, a, b);
      expected += periodExpected;
      achieved += Math.min(done, periodExpected);
      p = addDays(last, 1);
    }
  }
  return { expected, achieved };
}

export function scoreRoutines(routines: Routine[], logs: LogIndex, from: Date, to: Date, now = new Date()): Score {
  return routines.reduce(
    (acc, r) => addScores(acc, scoreRoutine(r, logs, from, to, now)),
    { expected: 0, achieved: 0 },
  );
}

/** Consecutive completed occurrences (days for fixed schedules, periods for flexible ones). */
export function streak(routine: Routine, logs: LogIndex, now = new Date()): number {
  const byDay = logs.get(routine.id);
  const start = fromDay(routine.start_date);
  let count = 0;

  if (!isFlexible(routine.schedule)) {
    let d = byDay?.has(toDay(now)) ? now : subDays(now, 1);
    for (let i = 0; i < 400 && !isBefore(d, start); i++, d = subDays(d, 1)) {
      if (!isFixedDueOn(routine, d)) continue;
      const value = logValue(byDay?.get(toDay(d)));
      if (value === null) continue; // skipped days neither break nor extend a streak
      if (value === 0) break;
      count++;
    }
    return count;
  }

  const target = flexibleTarget(routine.schedule);
  let p = periodStart(routine, now);
  if (completedBetween(byDay, p, now) < target) p = periodStart(routine, subDays(p, 1));
  for (let i = 0; i < 60 && !isBefore(periodEnd(routine, p), start); i++) {
    if (completedBetween(byDay, p, periodEnd(routine, p)) < target) break;
    count++;
    p = periodStart(routine, subDays(p, 1));
  }
  return count;
}

/**
 * Routines that count towards a person's own score: their personal ones plus family ones assigned to them.
 * Family ones are narrowed to that person (`scoredFor`), so turn-taking and planned swaps only count on their days.
 */
export function routinesFor(
  userId: string,
  routines: Routine[],
  categories: Map<string, RoutineCategory>,
): Routine[] {
  return routines.flatMap((r): Routine[] => {
    const c = categories.get(r.category_id);
    if (!c) return [];
    if (c.visibility === 'personal') return c.owner_id === userId ? [r] : [];
    const involved =
      r.assignee_ids.includes(userId) ||
      isDayAssignee(r, userId) ||
      [...(r.plans?.values() ?? [])].some((p) => p.planned && p.assignee_id === userId);
    return involved ? [{ ...r, scoredFor: userId }] : [];
  });
}

export function familyRoutines(routines: Routine[], categories: Map<string, RoutineCategory>) {
  return routines.filter((r) => categories.get(r.category_id)?.visibility === 'family');
}

export type Band = 'good' | 'ok' | 'bad' | 'none';
export const band = (p: number | null): Band => (p === null ? 'none' : p >= 80 ? 'good' : p >= 50 ? 'ok' : 'bad');
