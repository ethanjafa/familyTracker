import { isWeekPlanned, lastPlanningDay, PLANNING_DAY_NAMES, PLANNING_DAY_OPTIONS, planningDayOf } from '@/lib/planning';
import { categoryStats, movedFrom, sortTodos, todoDay } from '@/lib/projects';
import type { Household, Project } from '@/lib/types';

import { at, doneOn, todo } from './factories';

const THU = at('2026-11-12'); // Thursday
const household = (over: Partial<Household> = {}): Household => ({ id: 'h1', name: 'Home', ...over });

describe('planning day', () => {
  it('defaults to Sunday for families from before the setting existed', () => {
    expect(planningDayOf(household())).toBe(0);
  });

  it('finds the most recent planning day, today included', () => {
    expect(lastPlanningDay(household({ planning_day: 0 }), THU)).toBe('2026-11-08');
    expect(lastPlanningDay(household({ planning_day: 4 }), THU)).toBe('2026-11-12');
    expect(lastPlanningDay(household({ planning_day: 5 }), THU)).toBe('2026-11-06');
  });

  it('knows whether this cycle was planned', () => {
    const h = household({ planning_day: 0, planning_routine_id: 'plan' });
    expect(isWeekPlanned(h, doneOn('plan', '2026-11-08'), THU)).toBe(true);
    expect(isWeekPlanned(h, doneOn('plan', '2026-11-01'), THU)).toBe(false);
    expect(isWeekPlanned(household({ planning_day: 0 }), doneOn('plan', '2026-11-08'), THU)).toBe(false);
  });

  it('lists the days Monday first, with matching short and full names', () => {
    expect(PLANNING_DAY_OPTIONS.map((o) => o.label)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
    expect(PLANNING_DAY_NAMES[0]).toEqual({ value: 1, label: 'Monday' });
    expect(PLANNING_DAY_NAMES[6]).toEqual({ value: 0, label: 'Sunday' });
  });
});

describe('to-dos', () => {
  const TODAY = '2026-11-12';

  it('sorts open to-dos by deadline, with no deadline last and done ones at the end', () => {
    const items = [
      todo({ id: 'done', status: 'done', due_date: '2026-11-01' }),
      todo({ id: 'none' }),
      todo({ id: 'later', due_date: '2026-11-20' }),
      todo({ id: 'soon-b', due_date: '2026-11-13', sort_order: 2 }),
      todo({ id: 'soon-a', due_date: '2026-11-13', sort_order: 1 }),
    ];
    expect(sortTodos(items).map((i) => i.id)).toEqual(['soon-a', 'soon-b', 'later', 'none', 'done']);
    expect(items[0].id).toBe('done'); // the original list is left alone
  });

  it('puts a to-do on the day it was moved to in Plan, otherwise its own date', () => {
    expect(todoDay(todo({ due_date: '2026-11-20' }), TODAY)).toBe('2026-11-20');
    expect(todoDay(todo({ due_date: '2026-11-20', planned_date: '2026-11-14' }), TODAY)).toBe('2026-11-14');
    expect(todoDay(todo(), TODAY)).toBeNull();
  });

  it('moves open to-dos from past days on to today', () => {
    const late = todo({ due_date: '2026-11-10' });
    expect(todoDay(late, TODAY)).toBe(TODAY);
    expect(movedFrom(late, TODAY)).toBe('2026-11-10');
  });

  it('leaves finished and current to-dos on their own day', () => {
    const finished = todo({ due_date: '2026-11-10', status: 'done' });
    expect(todoDay(finished, TODAY)).toBe('2026-11-10');
    expect(movedFrom(finished, TODAY)).toBeNull();
    expect(movedFrom(todo({ due_date: TODAY }), TODAY)).toBeNull();
    expect(movedFrom(todo(), TODAY)).toBeNull();
  });

  it('summarises a category', () => {
    const cat = { id: 'p1' } as Project;
    const items = [
      todo({ id: 'a', due_date: '2026-11-20' }),
      todo({ id: 'b', due_date: '2026-11-10' }),
      todo({ id: 'c', status: 'done', due_date: '2026-11-01' }),
      todo({ id: 'other', project_id: 'p2', due_date: '2026-11-01' }),
    ];
    const stats = categoryStats(cat, items, TODAY);
    expect(stats.total).toBe(3);
    expect(stats.done).toBe(1);
    expect(stats.overdue).toBe(1);
    expect(stats.open.map((i) => i.id)).toEqual(['b', 'a']);
    expect(stats.next?.id).toBe('b');
  });

  it('has no next to-do in an empty category', () => {
    const stats = categoryStats({ id: 'p1' } as Project, [], TODAY);
    expect(stats).toMatchObject({ total: 0, done: 0, overdue: 0, next: undefined });
  });
});
