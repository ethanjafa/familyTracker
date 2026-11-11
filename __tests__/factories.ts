import { fromDay } from '@/lib/dates';
import { indexLogs } from '@/lib/scoring';
import type { GroceryItem, LogStatus, ProjectItem, Routine, RoutineCategory, RoutineLog, RoutinePlan } from '@/lib/types';

/** A local calendar day, e.g. day('2026-11-10'). Tests never depend on the machine's time zone. */
export const day = (s: string) => fromDay(s);

/** A moment during a day (3 pm), like the app sees when someone has it open. */
export const at = (s: string, hour = 15) => {
  const d = fromDay(s);
  d.setHours(hour);
  return d;
};

export const routine = (over: Partial<Routine> = {}): Routine => ({
  id: 'r1',
  category_id: 'c-family',
  household_id: 'h1',
  name: 'Dishes',
  schedule: { type: 'daily' },
  weight: 2,
  time_of_day: 'anytime',
  assignee_ids: [],
  start_date: '2026-01-01',
  archived_at: null,
  ...over,
});

export const log = (routineId: string, logDate: string, status: LogStatus = 'done', userId = 'u1'): RoutineLog => ({
  id: `${routineId}-${logDate}`,
  routine_id: routineId,
  household_id: 'h1',
  user_id: userId,
  log_date: logDate,
  status,
  note: null,
});

/** Done logs for one routine on the given days, indexed the way screens use them. */
export const doneOn = (routineId: string, ...days: string[]) => indexLogs(days.map((d) => log(routineId, d)));

export const plans = (routineId: string, entries: Record<string, { planned: boolean; assignee_id?: string | null }>) =>
  new Map<string, RoutinePlan>(
    Object.entries(entries).map(([planDate, p]) => [
      planDate,
      {
        id: `${routineId}-${planDate}`,
        routine_id: routineId,
        household_id: 'h1',
        plan_date: planDate,
        planned: p.planned,
        assignee_id: p.assignee_id ?? null,
      },
    ]),
  );

export const category = (over: Partial<RoutineCategory> = {}): RoutineCategory => ({
  id: 'c-family',
  household_id: 'h1',
  owner_id: 'u1',
  visibility: 'family',
  name: 'House',
  icon: '🧹',
  color: '#000',
  sort_order: 0,
  ...over,
});

export const todo = (over: Partial<ProjectItem> = {}): ProjectItem => ({
  id: 't1',
  project_id: 'p1',
  household_id: 'h1',
  title: 'Book the dentist',
  notes: null,
  status: 'todo',
  assignee_id: null,
  due_date: null,
  planned_date: null,
  cost: null,
  sort_order: 0,
  completed_at: null,
  updated_at: '2026-11-01T00:00:00Z',
  ...over,
});

export const grocery = (over: Partial<GroceryItem> = {}): GroceryItem => ({
  id: 'g1',
  household_id: 'h1',
  name: 'Milk',
  status: 'need',
  for_label: null,
  store: null,
  updated_at: '2026-11-01T00:00:00Z',
  ...over,
});
