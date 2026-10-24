import { addDays, format, parseISO, startOfMonth, startOfWeek } from 'date-fns';

/** Dates are stored as local calendar days in 'yyyy-MM-dd' form. */
export const toDay = (d: Date) => format(d, 'yyyy-MM-dd');
export const fromDay = (s: string) => parseISO(s);
export const today = () => toDay(new Date());

/** Weeks start on Monday. */
export const weekStart = (d: Date) => startOfWeek(d, { weekStartsOn: 1 });
export const monthStart = (d: Date) => startOfMonth(d);

export const prettyDay = (s: string) => format(fromDay(s), 'EEE d MMM');

/** The seven days (Mon → Sun) of the week starting at `start`. */
export const weekDays = (start: Date) => Array.from({ length: 7 }, (_, i) => addDays(start, i));

/** "Oct 26 – Nov 1" */
export const weekRange = (start: Date) => `${format(start, 'MMM d')} – ${format(addDays(start, 6), 'MMM d')}`;
