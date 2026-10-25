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

export function categoryStats(category: Project, items: ProjectItem[], today: string) {
  const own = items.filter((i) => i.project_id === category.id);
  const open = sortTodos(own.filter((i) => i.status !== 'done'));
  return {
    total: own.length,
    done: own.length - open.length,
    open,
    overdue: open.filter((i) => i.due_date && i.due_date < today).length,
    next: open[0],
  };
}
