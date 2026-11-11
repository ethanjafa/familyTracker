// The app's scheduling rules (src/lib/schedule.ts), for the MCP server: which days a routine is
// on, and who does it, including changes made on the Assign tab. Days are YYYY-MM-DD strings,
// handled in UTC so a date never shifts with the server's time zone.

export type Schedule =
  | { type: 'daily' }
  | { type: 'weekdays'; days: number[] }
  | { type: 'weekly'; times: number; days?: number[] }
  | { type: 'biweekly'; times: number; days?: number[] }
  | { type: 'monthly'; times: number }
  | { type: 'interval'; every: number };

export type Routine = {
  id: string;
  name: string;
  schedule: Schedule;
  assignee_ids: string[];
  day_assignees: Record<string, string> | null;
  start_date: string;
  private_to: string | null;
};

export type Plan = { planned: boolean; assignee_id: string | null };

export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const toDate = (day: string) => new Date(`${day}T00:00:00Z`);
export const toDay = (d: Date) => d.toISOString().slice(0, 10);
export const addDays = (day: string, n: number) => toDay(new Date(toDate(day).getTime() + n * 86_400_000));
export const weekday = (day: string) => toDate(day).getUTCDay();
const daysBetween = (from: string, to: string) => Math.round((toDate(to).getTime() - toDate(from).getTime()) / 86_400_000);

/** Monday of the week a day is in. */
export const weekStart = (day: string) => addDays(day, -((weekday(day) + 6) % 7));

const cycleDay = (r: Routine, day: string) => {
  const diff = daysBetween(weekStart(r.start_date), day);
  return ((diff % 14) + 14) % 14;
};

const defaultWeekdays = (s: Schedule) =>
  s.type === 'daily' ? [0, 1, 2, 3, 4, 5, 6] : s.type === 'weekdays' ? s.days : s.type === 'weekly' && s.days?.length ? s.days : null;
const hasDefaultDays = (s: Schedule) => defaultWeekdays(s) !== null || (s.type === 'biweekly' && !!s.days?.length);
const dayKey = (r: Routine, day: string) => (r.schedule.type === 'biweekly' ? `b${cycleDay(r, day)}` : String(weekday(day)));

export function describeSchedule(s: Schedule): string {
  switch (s.type) {
    case 'daily':
      return 'Every day';
    case 'weekdays':
      return [1, 2, 3, 4, 5, 6, 0].filter((d) => s.days.includes(d)).map((d) => DAY_NAMES[d]).join(', ');
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

function usualDueOn(r: Routine, day: string) {
  if (day < r.start_date) return false;
  const s = r.schedule;
  switch (s.type) {
    case 'daily':
      return true;
    case 'weekdays':
      return s.days.includes(weekday(day));
    case 'weekly':
      return !!s.days?.includes(weekday(day));
    case 'biweekly':
      return !!s.days?.includes(cycleDay(r, day));
    case 'interval':
      return daysBetween(r.start_date, day) % Math.max(1, s.every) === 0;
    default:
      return false;
  }
}

function usualAssignees(r: Routine, day: string) {
  const perDay = hasDefaultDays(r.schedule) && Object.values(r.day_assignees ?? {}).some(Boolean);
  if (!perDay) return r.assignee_ids;
  const id = r.day_assignees?.[dayKey(r, day)];
  return id ? [id] : [];
}

/** Whether a routine is on the plan that day, and who does it ([] = nobody yet). */
export function onDay(r: Routine, day: string, plan?: Plan) {
  const planned = plan ? plan.planned : usualDueOn(r, day);
  const who = plan?.planned && plan.assignee_id ? [plan.assignee_id] : usualAssignees(r, day);
  return { planned, who: planned ? who : [] };
}

// "Make lunch" and "Cook dinner" (src/lib/meal-routines.ts): routines every family has, with no
// days of their own. They are on exactly the days the meal plan has a cook for.

export type MealSlot = 'lunch' | 'dinner';
export type MealRoutineIds = { lunch_routine_id?: string | null; dinner_routine_id?: string | null };

/** Which meal a routine stands for, or null for an ordinary routine. */
export function mealSlotOf(ids: MealRoutineIds, routineId: string): MealSlot | null {
  if (routineId === ids.lunch_routine_id) return 'lunch';
  if (routineId === ids.dinner_routine_id) return 'dinner';
  return null;
}

/** A meal routine as the schedule rules should see it: never on by itself, nobody by default. */
export const asMealRoutine = <R extends Routine>(r: R): R => ({
  ...r,
  schedule: { type: 'weekdays', days: [] },
  assignee_ids: [],
  day_assignees: null,
});

/** The cook of a day's meal as that day's plan (undefined when nobody is cooking). */
export const cookPlan = (cookId: string | null | undefined): Plan | undefined =>
  cookId ? { planned: true, assignee_id: cookId } : undefined;
