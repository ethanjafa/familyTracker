import { getDay, subDays } from 'date-fns';

import { toDay } from '@/lib/dates';
import type { LogIndex } from '@/lib/scoring';
import type { Household } from '@/lib/types';

/** Weekdays as chip options, Monday first (values: 0 = Sunday … 6 = Saturday). */
export const PLANNING_DAY_OPTIONS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
];

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** The same days with full names, for the Settings dropdown. */
export const PLANNING_DAY_NAMES = PLANNING_DAY_OPTIONS.map((o) => ({ value: o.value, label: DAY_NAMES[o.value] }));

export const planningDayOf =(h: Household) => h.planning_day ?? 0;

/** The most recent planning day, today included: the current planning cycle. */
export const lastPlanningDay = (h: Household, now = new Date()) =>
  toDay(subDays(now, (getDay(now) - planningDayOf(h) + 7) % 7));

/** Whether the family checked off this cycle's "Plan the week together" task. */
export const isWeekPlanned = (h: Household, logIndex: LogIndex, now = new Date()) =>
  !!h.planning_routine_id && !!logIndex.get(h.planning_routine_id)?.has(lastPlanningDay(h, now));
