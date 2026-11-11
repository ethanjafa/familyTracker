import { setMealCook } from '@/api/meals';
import { friendlyLoadError, loadProblem } from '@/lib/load-problem';
import { mealSlotOf, withMealCooks } from '@/lib/meal-routines';
import { queryClient } from '@/lib/query-client';
import { isDueToday, wasPlannedOn } from '@/lib/schedule';
import { indexLogs, routinesFor, scoreRoutine } from '@/lib/scoring';
import type { Household, MealPlan } from '@/lib/types';
import { hasPending, inOrder } from '@/lib/write-queue';

import { at, category, day, doneOn, routine } from './factories';

// A stand-in for the meal_plans table that behaves like the real one: one row per day and slot.
const mockDb = {
  rows: [] as { household_id: string; plan_date: string; slot: string; cook_id: string | null; meal_id: string | null }[],
  calls: [] as string[],
  error: null as { message: string } | null,
  /** Makes each request take this long, to imitate a slow connection. */
  delay: 0,
};

jest.mock('@/lib/supabase', () => {
  const wait = () => new Promise((resolve) => setTimeout(resolve, mockDb.delay));
  const same = (a: Record<string, unknown>, b: Record<string, unknown>) =>
    a.household_id === b.household_id && a.plan_date === b.plan_date && a.slot === b.slot;
  return {
    supabase: {
      from: () => ({
        upsert: async (row: { household_id: string; plan_date: string; slot: string; cook_id: string | null }) => {
          mockDb.calls.push(`upsert ${row.cook_id}`);
          await wait();
          if (mockDb.error) return { error: mockDb.error };
          const existing = mockDb.rows.find((r) => same(r, row));
          if (existing) existing.cook_id = row.cook_id;
          else mockDb.rows.push({ ...row, meal_id: null });
          return { error: null };
        },
        delete: () => ({
          match: (where: Record<string, unknown>) => ({
            is: async () => {
              mockDb.calls.push('delete');
              await wait();
              if (mockDb.error) return { error: mockDb.error };
              mockDb.rows = mockDb.rows.filter((r) => !(same(r, where) && r.meal_id === null));
              return { error: null };
            },
          }),
        }),
      }),
    },
  };
});
jest.mock('@/api/groceries', () => ({ needGroceries: jest.fn() }));
jest.mock('@/providers/household-provider', () => ({ useHousehold: jest.fn() }));

const KEY = ['meal_plans', 'h1'];
const cached = () => queryClient.getQueryData<MealPlan[]>(KEY) ?? [];
const mealPlan = (over: Partial<MealPlan> = {}): MealPlan => ({
  id: 'mp1',
  household_id: 'h1',
  meal_id: null,
  plan_date: '2026-11-12',
  slot: 'dinner',
  cook_id: null,
  ...over,
});

beforeEach(() => {
  mockDb.rows = [];
  mockDb.calls = [];
  mockDb.error = null;
  mockDb.delay = 0;
  queryClient.clear();
  queryClient.setQueryData(KEY, []);
});

afterAll(() => queryClient.clear());

describe('setMealCook (the Meals boxes on Assign)', () => {
  it('puts a cook on a day that had nothing planned', async () => {
    await setMealCook('h1', '2026-11-12', 'dinner', 'ana');
    expect(mockDb.rows).toEqual([{ household_id: 'h1', plan_date: '2026-11-12', slot: 'dinner', cook_id: 'ana', meal_id: null }]);
  });

  it('shows the cook straight away, before the server answers', async () => {
    mockDb.delay = 20;
    const saving = setMealCook('h1', '2026-11-12', 'dinner', 'ana');
    expect(cached().map((p) => p.cook_id)).toEqual(['ana']);
    await saving;
  });

  it('survives two quick taps on the same box', async () => {
    mockDb.delay = 10;
    // The second tap lands while the first is still being saved.
    const first = setMealCook('h1', '2026-11-12', 'dinner', 'ana');
    const second = setMealCook('h1', '2026-11-12', 'dinner', 'ben');
    await expect(Promise.all([first, second])).resolves.toBeDefined();
    expect(mockDb.calls).toEqual(['upsert ana', 'upsert ben']);
    expect(mockDb.rows).toHaveLength(1);
    expect(mockDb.rows[0].cook_id).toBe('ben');
  });

  it('saves a burst of taps in the order they were made', async () => {
    mockDb.delay = 5;
    await Promise.all([
      setMealCook('h1', '2026-11-12', 'dinner', 'ana'),
      setMealCook('h1', '2026-11-12', 'dinner', 'ben'),
      setMealCook('h1', '2026-11-12', 'dinner', null),
      setMealCook('h1', '2026-11-12', 'dinner', 'ana'),
    ]);
    expect(mockDb.calls).toEqual(['upsert ana', 'upsert ben', 'delete', 'upsert ana']);
    expect(mockDb.rows.map((r) => r.cook_id)).toEqual(['ana']);
  });

  it('removes the row when the cook is cleared and no meal is chosen', async () => {
    await setMealCook('h1', '2026-11-12', 'dinner', 'ana');
    queryClient.setQueryData(KEY, [mealPlan({ cook_id: 'ana' })]);
    await setMealCook('h1', '2026-11-12', 'dinner', null);
    expect(mockDb.rows).toEqual([]);
  });

  it('keeps the meal when only its cook is cleared', async () => {
    mockDb.rows = [{ household_id: 'h1', plan_date: '2026-11-12', slot: 'dinner', cook_id: 'ana', meal_id: 'tacos' }];
    queryClient.setQueryData(KEY, [mealPlan({ cook_id: 'ana', meal_id: 'tacos' })]);
    await setMealCook('h1', '2026-11-12', 'dinner', null);
    expect(mockDb.rows).toEqual([{ household_id: 'h1', plan_date: '2026-11-12', slot: 'dinner', cook_id: null, meal_id: 'tacos' }]);
  });

  it('keeps lunch and dinner apart', async () => {
    await setMealCook('h1', '2026-11-12', 'lunch', 'ana');
    await setMealCook('h1', '2026-11-12', 'dinner', 'ben');
    expect(mockDb.rows.map((r) => `${r.slot}:${r.cook_id}`)).toEqual(['lunch:ana', 'dinner:ben']);
  });

  it('does nothing when there is no cook to clear', async () => {
    await setMealCook('h1', '2026-11-12', 'dinner', null);
    expect(mockDb.calls).toEqual([]);
  });

  it('reports a failed save', async () => {
    mockDb.error = { message: 'offline' };
    await expect(setMealCook('h1', '2026-11-12', 'dinner', 'ana')).rejects.toEqual({ message: 'offline' });
  });
});

describe('inOrder', () => {
  const later = <T>(value: T, ms: number) => new Promise<T>((resolve) => setTimeout(() => resolve(value), ms));

  it('runs saves for the same thing one at a time, in order', async () => {
    const seen: string[] = [];
    const slow = inOrder('box', async () => {
      await later(null, 20);
      seen.push('first');
    });
    const fast = inOrder('box', async () => {
      seen.push('second');
    });
    await Promise.all([slow, fast]);
    expect(seen).toEqual(['first', 'second']);
  });

  it('lets different things save at the same time', async () => {
    const seen: string[] = [];
    await Promise.all([
      inOrder('a', async () => {
        await later(null, 20);
        seen.push('a');
      }),
      inOrder('b', async () => {
        seen.push('b');
      }),
    ]);
    expect(seen).toEqual(['b', 'a']);
  });

  it('carries on after a failed save, and hands the failure to whoever asked', async () => {
    const failed = inOrder('box', async () => {
      throw new Error('offline');
    });
    const next = inOrder('box', async () => 'saved');
    await expect(failed).rejects.toThrow('offline');
    await expect(next).resolves.toBe('saved');
  });

  it('knows when saves are still on their way', async () => {
    const saving = inOrder('plans|h1|r1', () => later('done', 10));
    expect(hasPending('plans|h1|')).toBe(true);
    expect(hasPending('plans|h2|')).toBe(false);
    await saving;
    await later(null, 0);
    expect(hasPending('plans|h1|')).toBe(false);
  });
});

describe('load problems', () => {
  const query = (over: Partial<Parameters<typeof loadProblem>[0]> = {}) => ({
    isError: false,
    isFetching: false,
    data: undefined as unknown,
    error: null as unknown,
    refetch: jest.fn(),
    ...over,
  });

  it('is nothing while loading or once loaded', () => {
    expect(loadProblem(query(), query({ data: [] }))).toBeNull();
  });

  it('reports a load that failed with nothing to show', () => {
    const failed = query({ isError: true, error: new Error('Network request failed') });
    const problem = loadProblem(query({ data: [] }), failed);
    expect(problem?.message).toBe('Check your internet connection and try again.');
    expect(problem?.retrying).toBe(false);
  });

  it('keeps showing what is on screen when only a refresh failed', () => {
    expect(loadProblem(query({ isError: true, data: [1], error: new Error('offline') }))).toBeNull();
  });

  it('retries just the loads that failed', () => {
    const fine = query({ data: [] });
    const failed = query({ isError: true, error: { message: 'permission denied' } });
    loadProblem(fine, failed)?.retry();
    expect(failed.refetch).toHaveBeenCalledTimes(1);
    expect(fine.refetch).not.toHaveBeenCalled();
  });

  it('says when a retry is under way', () => {
    expect(loadProblem(query({ isError: true, isFetching: true }))?.retrying).toBe(true);
  });

  it('explains network failures plainly and passes other messages through', () => {
    expect(friendlyLoadError(new TypeError('Failed to fetch'))).toBe('Check your internet connection and try again.');
    expect(friendlyLoadError({ message: 'permission denied for table routines' })).toBe('permission denied for table routines');
    expect(friendlyLoadError({ message: '' })).toBe('Something went wrong. Please try again.');
  });
});

describe('meal routines ("Make lunch" and "Cook dinner")', () => {
  const household: Household = { id: 'h1', name: 'Home', lunch_routine_id: 'lunch', dinner_routine_id: 'dinner' };
  const lunch = routine({ id: 'lunch', name: 'Make lunch', schedule: { type: 'daily' }, assignee_ids: ['ben'], start_date: '2026-11-01' });
  const dinner = routine({ id: 'dinner', name: 'Cook dinner', start_date: '2026-11-01' });
  const dishes = routine({ id: 'dishes', assignee_ids: ['ana'] });
  const cooks = [
    mealPlan({ id: 'a', plan_date: '2026-11-11', cook_id: 'ben' }),
    mealPlan({ id: 'b', plan_date: '2026-11-12', cook_id: 'ana' }),
    mealPlan({ id: 'c', plan_date: '2026-11-13', cook_id: null, meal_id: 'tacos' }),
    mealPlan({ id: 'd', plan_date: '2026-11-12', slot: 'lunch', cook_id: 'ben' }),
  ];
  const [lunchR, dinnerR, dishesR] = withMealCooks([lunch, dinner, dishes], cooks, household);
  const TODAY = at('2026-11-12');

  it('knows which routine stands for which meal', () => {
    expect(mealSlotOf(household, 'lunch')).toBe('lunch');
    expect(mealSlotOf(household, 'dinner')).toBe('dinner');
    expect(mealSlotOf(household, 'dishes')).toBeNull();
    expect(mealSlotOf({ id: 'h1', name: 'Before the update' }, 'dinner')).toBeNull();
  });

  it('leaves ordinary routines alone', () => {
    expect(dishesR).toBe(dishes);
  });

  it('shows dinner on Today only when someone is cooking', () => {
    expect(isDueToday(dinnerR, undefined, day('2026-11-12'))).toBe(true);
    expect(isDueToday(dinnerR, undefined, day('2026-11-13'))).toBe(false); // a meal, but no cook
    expect(isDueToday(dinnerR, undefined, day('2026-11-14'))).toBe(false); // nothing planned
  });

  it('ignores whatever days or owners the routine itself was given', () => {
    // Lunch was saved as "every day, Ben", but only the 12th has a cook.
    expect(isDueToday(lunchR, undefined, day('2026-11-12'))).toBe(true);
    expect(isDueToday(lunchR, undefined, day('2026-11-13'))).toBe(false);
  });

  it("puts it on the cook's own list, not on everyone's", () => {
    const categories = new Map([['c-family', category()]]);
    const mine = (userId: string, date: string) =>
      routinesFor(userId, [dinnerR], categories).filter((r) => isDueToday(r, undefined, day(date))).map((r) => r.id);
    expect(mine('ana', '2026-11-12')).toEqual(['dinner']);
    expect(mine('ben', '2026-11-12')).toEqual([]);
    expect(mine('ben', '2026-11-11')).toEqual(['dinner']);
  });

  it('counts towards the score like any routine', () => {
    // Wed 11 (Ben, not ticked) and Thu 12 (Ana, ticked today).
    const logs = doneOn('dinner', '2026-11-12');
    expect(scoreRoutine(dinnerR, logs, day('2026-11-09'), day('2026-11-15'), TODAY)).toEqual({ expected: 2, achieved: 1 });
    expect(scoreRoutine({ ...dinnerR, scoredFor: 'ana' }, logs, day('2026-11-09'), day('2026-11-15'), TODAY)).toEqual({ expected: 1, achieved: 1 });
  });

  it('can be caught up on when a cooking day was missed', () => {
    expect(wasPlannedOn(dinnerR, day('2026-11-11'))).toBe(true);
    expect(wasPlannedOn(dinnerR, day('2026-11-10'))).toBe(false);
    expect(scoreRoutine(dinnerR, indexLogs([]), day('2026-11-11'), day('2026-11-11'), TODAY)).toEqual({ expected: 1, achieved: 0 });
  });
});
