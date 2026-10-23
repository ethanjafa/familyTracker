import { differenceInCalendarDays, parseISO } from 'date-fns';

import type { ItemStatus, Project, ProjectItem } from '@/lib/types';

export const STALL_DAYS = 14;

export const ITEM_STATUS: Record<ItemStatus, { label: string; icon: string }> = {
  todo: { label: 'To do', icon: '⚪' },
  in_progress: { label: 'In progress', icon: '🔵' },
  blocked: { label: 'Blocked', icon: '🔴' },
  done: { label: 'Done', icon: '✅' },
};

export const NEXT_STATUS: Record<ItemStatus, ItemStatus> = {
  todo: 'in_progress',
  in_progress: 'done',
  blocked: 'in_progress',
  done: 'todo',
};

const STATUS_ORDER: ItemStatus[] = ['in_progress', 'blocked', 'todo', 'done'];

export function sortItems(items: ProjectItem[]) {
  return [...items].sort(
    (a, b) =>
      STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) ||
      (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999') ||
      a.sort_order - b.sort_order,
  );
}

export function projectStats(project: Project, items: ProjectItem[], today: string) {
  const own = items.filter((i) => i.project_id === project.id);
  const done = own.filter((i) => i.status === 'done').length;
  const open = sortItems(own.filter((i) => i.status !== 'done'));
  const lastActivity = [project.updated_at, ...own.map((i) => i.updated_at)].sort().at(-1)!;
  const idleDays = differenceInCalendarDays(new Date(), parseISO(lastActivity));
  return {
    total: own.length,
    done,
    percent: own.length ? Math.round((100 * done) / own.length) : 0,
    overdue: open.filter((i) => i.due_date && i.due_date < today).length,
    blocked: open.filter((i) => i.status === 'blocked').length,
    next: open.find((i) => i.status !== 'blocked'),
    spent: own.reduce((sum, i) => sum + (Number(i.cost) || 0), 0),
    idleDays,
    stalled: project.status === 'active' && open.length > 0 && idleDays >= STALL_DAYS,
  };
}

export const money = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 0 });
