/**
 * The Claude connector (supabase/functions/mcp) has its own copy of the scheduling rules, because
 * Edge Functions can't import app code. These tests fail when the two copies drift apart, so the
 * assistant never tells someone a different plan than the app shows.
 */
import { addDays as addLocalDays } from 'date-fns';

import { fromDay, toDay, weekStart } from '@/lib/dates';
import { mealSlotOf, withMealCooks } from '@/lib/meal-routines';
import { assigneesOn, describeSchedule, plannedOn } from '@/lib/schedule';
import type { Household, MealPlan, Schedule } from '@/lib/types';

import * as mcp from '../supabase/functions/mcp/schedule';
import { plans, routine } from './factories';

type Case = {
  name: string;
  schedule: Schedule;
  start_date?: string;
  assignee_ids?: string[];
  day_assignees?: Record<string, string>;
  plans?: Record<string, { planned: boolean; assignee_id?: string | null }>;
};

const CASES: Case[] = [
  { name: 'daily, shared', schedule: { type: 'daily' }, assignee_ids: ['ana', 'ben'] },
  { name: 'daily, nobody', schedule: { type: 'daily' } },
  { name: 'daily, taking turns', schedule: { type: 'daily' }, day_assignees: { '0': 'ana', '1': 'ben', '3': 'ana', '6': 'ben' } },
  { name: 'picked weekdays', schedule: { type: 'weekdays', days: [1, 4, 0] }, assignee_ids: ['ana'] },
  { name: 'picked weekdays, taking turns', schedule: { type: 'weekdays', days: [1, 4] }, assignee_ids: ['ana'], day_assignees: { '1': 'ana', '4': 'ben' } },
  { name: 'weekly, no days', schedule: { type: 'weekly', times: 2 }, assignee_ids: ['ana'], day_assignees: { '1': 'ben' } },
  { name: 'weekly with days', schedule: { type: 'weekly', times: 2, days: [2, 6] }, day_assignees: { '2': 'ana', '6': 'ben' } },
  { name: 'every 2 weeks, no days', schedule: { type: 'biweekly', times: 1 }, assignee_ids: ['ben'] },
  {
    name: 'every 2 weeks with days, started midweek',
    schedule: { type: 'biweekly', times: 2, days: [0, 8, 13] },
    start_date: '2026-10-21',
    day_assignees: { b0: 'ana', b8: 'ben' },
  },
  { name: 'monthly', schedule: { type: 'monthly', times: 2 }, assignee_ids: ['ana'] },
  { name: 'every 3 days', schedule: { type: 'interval', every: 3 }, start_date: '2026-10-20', assignee_ids: ['ana'] },
  { name: 'broken interval of 0', schedule: { type: 'interval', every: 0 }, start_date: '2026-10-20' },
  { name: 'starts mid-range', schedule: { type: 'daily' }, start_date: '2026-11-20', assignee_ids: ['ana'] },
  {
    name: 'with changes made in Plan',
    schedule: { type: 'weekdays', days: [1, 3] },
    assignee_ids: ['ana'],
    plans: {
      '2026-11-09': { planned: false },
      '2026-11-10': { planned: true, assignee_id: 'ben' },
      '2026-11-11': { planned: true },
      '2026-11-12': { planned: false, assignee_id: 'ben' },
    },
  },
];

// 15 Oct – 31 Dec 2026 crosses the end of daylight saving time, where naive date maths goes wrong.
const DAYS: string[] = [];
for (let d = '2026-10-15'; d <= '2026-12-31'; d = mcp.addDays(d, 1)) DAYS.push(d);

describe('MCP date helpers match the app', () => {
  it('steps through days the same way', () => {
    expect(DAYS).toHaveLength(78);
    expect(DAYS).toEqual(DAYS.map((_, i) => toDay(addLocalDays(fromDay('2026-10-15'), i))));
  });

  it('agrees on weekdays and week starts', () => {
    for (const d of DAYS) {
      expect(mcp.weekday(d)).toBe(fromDay(d).getDay());
      expect(mcp.weekStart(d)).toBe(toDay(weekStart(fromDay(d))));
    }
  });
});

describe('MCP schedule rules match the app', () => {
  it.each(CASES)('$name', (c) => {
    const start = c.start_date ?? '2026-01-01';
    const app = routine({
      schedule: c.schedule,
      start_date: start,
      assignee_ids: c.assignee_ids ?? [],
      day_assignees: c.day_assignees,
      plans: c.plans ? plans('r1', c.plans) : undefined,
    });
    const server: mcp.Routine = {
      id: 'r1',
      name: 'Dishes',
      schedule: c.schedule,
      start_date: start,
      assignee_ids: c.assignee_ids ?? [],
      day_assignees: c.day_assignees ?? null,
      private_to: null,
    };

    expect(mcp.describeSchedule(c.schedule)).toBe(describeSchedule(c.schedule));

    for (const d of DAYS) {
      const plan = c.plans?.[d];
      const fromServer = mcp.onDay(server, d, plan && { planned: plan.planned, assignee_id: plan.assignee_id ?? null });
      const planned = plannedOn(app, fromDay(d));
      const fromApp = { planned, who: planned ? assigneesOn(app, fromDay(d)) : [] };
      expect({ day: d, ...fromServer }).toEqual({ day: d, ...fromApp });
    }
  });
});

describe('MCP meal routines match the app', () => {
  const household: Household = { id: 'h1', name: 'Home', lunch_routine_id: 'lunch', dinner_routine_id: 'dinner' };
  const cooks: Record<string, string | null> = { '2026-11-09': 'ana', '2026-11-11': 'ben', '2026-11-12': null };
  const mealPlans: MealPlan[] = Object.entries(cooks).map(([plan_date, cook_id]) => ({
    id: plan_date,
    household_id: 'h1',
    meal_id: null,
    plan_date,
    slot: 'dinner',
    cook_id,
  }));

  it('recognises the same routines as meals', () => {
    for (const id of ['lunch', 'dinner', 'dishes']) expect(mcp.mealSlotOf(household, id)).toBe(mealSlotOf(household, id));
    expect(mcp.mealSlotOf({}, 'dinner')).toBeNull();
  });

  it('puts dinner on the same days, with the same cook', () => {
    // Saved as "every day, Ana": both sides must ignore that and follow the cooks.
    const saved = { id: 'dinner', schedule: { type: 'daily' } as Schedule, assignee_ids: ['ana'], start_date: '2026-01-01' };
    const [app] = withMealCooks([routine(saved)], mealPlans, household);
    const server = mcp.asMealRoutine({ ...saved, name: 'Cook dinner', day_assignees: null, private_to: null });

    for (const d of DAYS) {
      const fromServer = mcp.onDay(server, d, mcp.cookPlan(cooks[d]));
      const planned = plannedOn(app, fromDay(d));
      expect({ day: d, ...fromServer }).toEqual({ day: d, planned, who: planned ? assigneesOn(app, fromDay(d)) : [] });
    }
    expect(DAYS.filter((d) => mcp.onDay(server, d, mcp.cookPlan(cooks[d])).planned)).toEqual(['2026-11-09', '2026-11-11']);
  });
});
