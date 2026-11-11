import type { GroceryItem } from '@/lib/types';

/** Names are matched ignoring case and surrounding spaces, so "Milk " and "milk" are one item. */
export const normalizeName = (name: string) => name.trim().toLowerCase();

/** The distinct names to add, trimmed, keyed by their normalized form. Blank names are dropped. */
export const wantedNames = (names: string[]) => [
  ...new Map(names.filter((n) => n.trim()).map((n) => [normalizeName(n), n.trim()])).entries(),
];

/** The stores this household already uses, so picking one is a tap, not typing. Case-insensitive. */
export function storesOf(items: GroceryItem[]) {
  const seen = new Map<string, string>();
  for (const i of items) if (i.store && !seen.has(i.store.toLowerCase())) seen.set(i.store.toLowerCase(), i.store);
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

/** Items grouped by store, A–Z, with items that have no store last. */
export function byStore(items: GroceryItem[]) {
  const groups = new Map<string, { store: string | null; items: GroceryItem[] }>();
  for (const i of items) {
    const key = i.store?.toLowerCase() ?? '';
    if (!groups.has(key)) groups.set(key, { store: i.store ?? null, items: [] });
    groups.get(key)!.items.push(i);
  }
  return [...groups.values()].sort((a, b) => (a.store === null ? 1 : b.store === null ? -1 : a.store.localeCompare(b.store)));
}
