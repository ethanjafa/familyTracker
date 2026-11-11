import { errorMessage } from '@/lib/errors';
import { byStore, normalizeName, storesOf, wantedNames } from '@/lib/groceries';
import { categoryIcon, mealIcon } from '@/lib/icons';
import {
  CATEGORY_TEMPLATES,
  getTemplate,
  routineIdeas,
  suggestedCategories,
  suggestedRoutines,
  templateFor,
} from '@/lib/suggestions';
import { applyOrder, loadOrder, mergeOrder, saveOrder } from '@/lib/today-order';

import { category, grocery, routine } from './factories';

describe('errorMessage', () => {
  it('reads Errors, Supabase-style objects and anything else', () => {
    expect(errorMessage(new Error('boom'))).toBe('boom');
    expect(errorMessage({ message: 'row not found', code: 'PGRST116' })).toBe('row not found');
    expect(errorMessage('plain')).toBe('plain');
    expect(errorMessage(null)).toBe('null');
  });
});

describe('groceries', () => {
  it('matches names ignoring case and spaces', () => {
    expect(normalizeName('  Milk ')).toBe('milk');
  });

  it('dedupes what you typed, drops blanks and keeps the last spelling', () => {
    expect(wantedNames([' Milk', 'eggs', 'MILK', '  ', ''])).toEqual([
      ['milk', 'MILK'],
      ['eggs', 'eggs'],
    ]);
  });

  it('lists each store once, A–Z, whatever the capitals', () => {
    const items = [
      grocery({ store: 'Food Basics' }),
      grocery({ store: 'Costco' }),
      grocery({ store: 'costco' }),
      grocery({ store: null }),
    ];
    expect(storesOf(items)).toEqual(['Costco', 'Food Basics']);
    expect(storesOf([])).toEqual([]);
  });

  it('groups the shopping list by store, with untagged items last', () => {
    const groups = byStore([
      grocery({ id: 'bread' }),
      grocery({ id: 'rice', store: 'Food Basics' }),
      grocery({ id: 'milk', store: 'Costco' }),
      grocery({ id: 'eggs', store: 'costco' }),
    ]);
    expect(groups.map((g) => g.store)).toEqual(['Costco', 'Food Basics', null]);
    expect(groups.map((g) => g.items.map((i) => i.id))).toEqual([['milk', 'eggs'], ['rice'], ['bread']]);
  });

  it('is one unnamed group when nothing has a store', () => {
    const groups = byStore([grocery({ id: 'a' }), grocery({ id: 'b' })]);
    expect(groups).toHaveLength(1);
    expect(groups[0].store).toBeNull();
    expect(byStore([])).toEqual([]);
  });
});

describe('icons', () => {
  it('picks an icon from keywords in the name, ignoring case', () => {
    expect(categoryIcon('House cleaning')).toBe('🧹');
    expect(categoryIcon('LAUNDRY')).toBe('🧺');
    expect(categoryIcon('Pay the bills')).toBe('💰');
    expect(mealIcon('Spaghetti bolognese')).toBe('🍝');
    expect(mealIcon('Chicken curry')).toBe('🍛');
  });

  it('gives an unknown name the same icon every time', () => {
    const first = categoryIcon('Qwzx');
    expect(first).toBeTruthy();
    expect(categoryIcon('Qwzx')).toBe(first);
    expect(categoryIcon('qwzx')).toBe(first);
    expect(mealIcon('Qwzx')).toBe(mealIcon('Qwzx'));
  });
});

describe('suggestions', () => {
  it('has well-formed templates', () => {
    const keys = CATEGORY_TEMPLATES.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const t of CATEGORY_TEMPLATES) {
      expect(t.routines.length).toBeGreaterThan(0);
      for (const r of t.routines) {
        expect(r.name.trim()).toBe(r.name);
        if (r.schedule.type === 'weekdays') {
          expect(r.schedule.days.length).toBeGreaterThan(0);
          expect(r.schedule.days.every((d) => d >= 0 && d <= 6)).toBe(true);
        }
        if ('times' in r.schedule) expect(r.schedule.times).toBeGreaterThan(0);
      }
    }
  });

  it('matches a category to a template by name, then keywords, then icon', () => {
    expect(templateFor({ name: ' laundry ', icon: '❓' })?.key).toBe('laundry');
    expect(templateFor({ name: 'Our dog', icon: '❓' })?.key).toBe('pets');
    expect(templateFor({ name: 'Zzz', icon: '💰' })?.key).toBe('money');
    expect(templateFor({ name: 'Zzz', icon: '❓' })).toBeUndefined();
  });

  it('suggests only routines the category does not have yet', () => {
    const laundry = category({ name: 'Laundry' });
    const all = suggestedRoutines(laundry, []);
    const left = suggestedRoutines(laundry, [routine({ name: 'iron clothes' })]);
    expect(all.map((r) => r.name)).toContain('Iron clothes');
    expect(left).toHaveLength(all.length - 1);
    expect(left.map((r) => r.name)).not.toContain('Iron clothes');
    expect(suggestedRoutines(category({ name: 'Zzz', icon: '❓' }), [])).toEqual([]);
  });

  it('suggests categories the family does not cover yet', () => {
    const before = suggestedCategories([]);
    const after = suggestedCategories([category({ name: 'Pets' })]);
    expect(before).toHaveLength(CATEGORY_TEMPLATES.length);
    expect(after.map((t) => t.key)).not.toContain('pets');
    expect(after).toHaveLength(before.length - 1);
  });

  it("offers routine ideas: the category's own first, filtered by what you type, never twice", () => {
    const pets = category({ name: 'Pets' });
    const ideas = routineIdeas(pets, [], '');
    expect(ideas[0].name).toBe('Feed the pets');
    const names = ideas.map((i) => i.name.toLowerCase());
    expect(new Set(names).size).toBe(names.length);

    expect(routineIdeas(pets, [], 'WALK').every((i) => i.name.toLowerCase().includes('walk'))).toBe(true);
    expect(routineIdeas(pets, [routine({ name: 'Feed the pets' })], '').map((i) => i.name)).not.toContain('Feed the pets');
    expect(routineIdeas(undefined, [], 'zzzz')).toEqual([]);
  });

  it('looks templates up by key', () => {
    expect(getTemplate('house')?.name).toBe('House cleanliness');
    expect(getTemplate('nope')).toBeUndefined();
  });
});

describe('Today order', () => {
  const store = new Map<string, string>();
  const original = (globalThis as { localStorage?: unknown }).localStorage;

  beforeEach(() => {
    store.clear();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
        removeItem: (k: string) => void store.delete(k),
      },
    });
  });

  afterAll(() => {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: original });
  });

  it('sorts by the saved order and keeps new things after, in their usual order', () => {
    const items = ['a', 'b', 'c', 'd'];
    expect(applyOrder(items, (x) => x, ['c', 'a'])).toEqual(['c', 'a', 'b', 'd']);
    expect(applyOrder(items, (x) => x, [])).toEqual(items);
    expect(applyOrder(items, (x) => x, ['gone', 'd'])).toEqual(['d', 'a', 'b', 'c']);
  });

  it('remembers the place of things not shown today', () => {
    expect(mergeOrder(['b', 'a'], ['a', 'x', 'b', 'y'])).toEqual(['b', 'a', 'x', 'y']);
  });

  it('saves the order per person', () => {
    saveOrder('ana', ['b', 'a']);
    expect(loadOrder('ana')).toEqual(['b', 'a']);
    expect(loadOrder('ben')).toEqual([]);
  });

  it('falls back to no order when what was saved is unreadable', () => {
    store.set('today-order:ana', '{not json');
    expect(loadOrder('ana')).toEqual([]);
    store.set('today-order:ana', '{"a":1}');
    expect(loadOrder('ana')).toEqual([]);
  });

  it('survives storage being unavailable', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: () => {
          throw new Error('blocked');
        },
        setItem: () => {
          throw new Error('blocked');
        },
      },
    });
    expect(() => saveOrder('ana', ['a'])).not.toThrow();
    expect(loadOrder('ana')).toEqual([]);
  });
});
