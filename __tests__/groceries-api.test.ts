import { needGroceries, setGroceryStatus, setGroceryStore } from '@/api/groceries';
import { showAlert } from '@/lib/dialogs';
import { queryClient } from '@/lib/query-client';
import type { GroceryItem } from '@/lib/types';

import { grocery } from './factories';

// A stand-in for the database: what the list holds, what was written, and an error to return.
const mockDb = {
  existing: [] as Pick<GroceryItem, 'id' | 'name' | 'status'>[],
  inserted: [] as Record<string, unknown>[],
  updates: [] as { changes: Record<string, unknown>; ids: string[] }[],
  error: null as { message: string } | null,
};

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: async () => ({ data: mockDb.existing, error: mockDb.error }) }),
      insert: async (rows: Record<string, unknown>[]) => {
        mockDb.inserted.push(...rows);
        return { error: mockDb.error };
      },
      update: (changes: Record<string, unknown>) => ({
        in: async (_column: string, ids: string[]) => {
          mockDb.updates.push({ changes, ids });
          return { error: mockDb.error };
        },
        eq: async (_column: string, id: string) => {
          mockDb.updates.push({ changes, ids: [id] });
          return { error: mockDb.error };
        },
      }),
    }),
  },
}));
jest.mock('@/lib/dialogs', () => ({ showAlert: jest.fn() }));
jest.mock('@/providers/household-provider', () => ({ useHousehold: jest.fn() }));

const KEY = ['grocery_items', 'h1'];
const cached = () => queryClient.getQueryData<GroceryItem[]>(KEY);

beforeEach(() => {
  mockDb.existing = [];
  mockDb.inserted = [];
  mockDb.updates = [];
  mockDb.error = null;
  queryClient.clear();
  jest.clearAllMocks();
});

describe('needGroceries', () => {
  it('adds new items to the shopping list', async () => {
    const count = await needGroceries('h1', ['Milk', ' eggs ']);
    expect(count).toBe(2);
    expect(mockDb.inserted).toEqual([
      { household_id: 'h1', name: 'Milk', status: 'need', for_label: null },
      { household_id: 'h1', name: 'eggs', status: 'need', for_label: null },
    ]);
    expect(mockDb.updates).toEqual([]);
  });

  it('moves items you have (or keep in the backlog) back to need instead of duplicating them', async () => {
    mockDb.existing = [
      { id: 'g-milk', name: 'Milk', status: 'have' },
      { id: 'g-rice', name: 'Rice', status: 'backlog' },
    ];
    const count = await needGroceries('h1', ['milk', 'RICE'], 'Tacos');
    expect(count).toBe(2);
    expect(mockDb.inserted).toEqual([]);
    expect(mockDb.updates).toEqual([{ changes: { status: 'need', for_label: 'Tacos' }, ids: ['g-milk', 'g-rice'] }]);
  });

  it('leaves items that are already needed alone', async () => {
    mockDb.existing = [{ id: 'g-milk', name: 'Milk', status: 'need' }];
    expect(await needGroceries('h1', ['Milk'])).toBe(0);
    expect(mockDb.inserted).toEqual([]);
    expect(mockDb.updates).toEqual([]);
  });

  it('says what a new item is for (the meal it was planned with)', async () => {
    await needGroceries('h1', ['Tortillas'], 'Tacos');
    expect(mockDb.inserted[0]).toMatchObject({ name: 'Tortillas', for_label: 'Tacos' });
  });

  it('does nothing for an empty list', async () => {
    expect(await needGroceries('h1', ['', '   '])).toBe(0);
    expect(mockDb.inserted).toEqual([]);
  });

  it('adds a name typed twice only once', async () => {
    expect(await needGroceries('h1', ['Milk', 'milk'])).toBe(1);
    expect(mockDb.inserted).toHaveLength(1);
  });

  it('fails loudly when the list cannot be read', async () => {
    mockDb.error = { message: 'offline' };
    await expect(needGroceries('h1', ['Milk'])).rejects.toEqual({ message: 'offline' });
  });
});

describe('setGroceryStatus', () => {
  it('ticks an item off straight away and forgets what it was for', async () => {
    const milk = grocery({ id: 'milk', for_label: 'Tacos', store: 'Costco' });
    queryClient.setQueryData(KEY, [milk, grocery({ id: 'eggs' })]);

    const done = setGroceryStatus(milk, 'have');
    // Before the server has answered: the list already shows it.
    expect(cached()?.find((i) => i.id === 'milk')).toMatchObject({ status: 'have', for_label: null, store: 'Costco' });
    await done;

    expect(mockDb.updates).toEqual([{ changes: { status: 'have', for_label: null }, ids: ['milk'] }]);
    expect(cached()?.find((i) => i.id === 'eggs')?.status).toBe('need');
    expect(showAlert).not.toHaveBeenCalled();
  });

  it('keeps the "for" label while an item is still needed', async () => {
    await setGroceryStatus(grocery({ id: 'milk', status: 'have', for_label: 'Tacos' }), 'need');
    expect(mockDb.updates[0].changes).toEqual({ status: 'need', for_label: 'Tacos' });
  });

  it('tells you when saving failed', async () => {
    mockDb.error = { message: 'offline' };
    await setGroceryStatus(grocery(), 'have');
    expect(showAlert).toHaveBeenCalledWith('Could not update', 'offline');
  });
});

describe('setGroceryStore', () => {
  it('saves the store, trimmed, and shows it straight away', async () => {
    const milk = grocery({ id: 'milk' });
    queryClient.setQueryData(KEY, [milk]);
    const done = setGroceryStore(milk, '  Costco ');
    expect(cached()?.[0].store).toBe('Costco');
    await done;
    expect(mockDb.updates).toEqual([{ changes: { store: 'Costco' }, ids: ['milk'] }]);
  });

  it('clears the store with null or an empty name', async () => {
    await setGroceryStore(grocery({ id: 'a', store: 'Costco' }), null);
    await setGroceryStore(grocery({ id: 'b', store: 'Costco' }), '   ');
    expect(mockDb.updates.map((u) => u.changes)).toEqual([{ store: null }, { store: null }]);
  });
});
