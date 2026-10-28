/**
 * Your own order of things on Today, kept on this device (it's a personal preference,
 * not shared with the family). Anything not in the saved order keeps its usual place after.
 */

const key = (userId: string) => `today-order:${userId}`;

export function loadOrder(userId: string): string[] {
  try {
    const saved = JSON.parse(localStorage.getItem(key(userId)) ?? '[]');
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

export function saveOrder(userId: string, order: string[]) {
  try {
    localStorage.setItem(key(userId), JSON.stringify(order));
  } catch {
    // Storage can be unavailable (e.g. private browsing); the order just isn't remembered.
  }
}

/** Sort items by the saved order; unknown items go last in their original order. */
export function applyOrder<T>(items: T[], keyOf: (item: T) => string, order: string[]): T[] {
  const rank = new Map(order.map((k, i) => [k, i]));
  return items
    .map((item, i) => ({ item, i, r: rank.get(keyOf(item)) ?? Infinity }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map((x) => x.item);
}

/** Put the reordered keys first, keeping the rest of the saved order (things not shown today) after. */
export const mergeOrder = (reordered: string[], previous: string[]) => [
  ...reordered,
  ...previous.filter((k) => !reordered.includes(k)),
];
