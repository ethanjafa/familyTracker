import type { Project, ProjectItem } from '@/lib/types';

/**
 * To-dos are stored as project items and their categories as projects, so the
 * tables stay the same while the app only uses a title, a deadline and done / not done.
 */

/** Open to-dos first (earliest deadline first, no deadline last), then done ones. */
export function sortTodos(items: ProjectItem[]) {
  return [...items].sort(
    (a, b) =>
      Number(a.status === 'done') - Number(b.status === 'done') ||
      (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999') ||
      a.sort_order - b.sort_order,
  );
}

/**
 * The day a to-do is on: the day it was moved to in Plan, otherwise its own date.
 * Open to-dos whose day has passed move on to today automatically. null = backlog.
 */
export function todoDay(item: ProjectItem, today: string): string | null {
  const day = item.planned_date ?? item.due_date ?? null;
  if (day && day < today && item.status !== 'done') return today;
  return day;
}

/** The day a moved-on to-do was originally for, or null if it's on its own day. */
export const movedFrom = (item: ProjectItem, today: string) => {
  const day = item.planned_date ?? item.due_date ?? null;
  return day && day < today && item.status !== 'done' ? day : null;
};

export function categoryStats(category: Project, items: ProjectItem[], today: string) {
  const own = items.filter((i) => i.project_id === category.id);
  const open = sortTodos(own.filter((i) => i.status !== 'done'));
  return {
    total: own.length,
    done: own.length - open.length,
    open,
    // Not done on their day (their date has passed).
    overdue: open.filter((i) => i.due_date && i.due_date < today).length,
    next: open[0],
  };
}
