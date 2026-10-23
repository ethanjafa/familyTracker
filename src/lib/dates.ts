import { format, parseISO, startOfMonth, startOfWeek } from 'date-fns';

/** Dates are stored as local calendar days in 'yyyy-MM-dd' form. */
export const toDay = (d: Date) => format(d, 'yyyy-MM-dd');
export const fromDay = (s: string) => parseISO(s);
export const today = () => toDay(new Date());

/** Weeks start on Monday. */
export const weekStart = (d: Date) => startOfWeek(d, { weekStartsOn: 1 });
export const monthStart = (d: Date) => startOfMonth(d);

export const prettyDay = (s: string) => format(fromDay(s), 'EEE d MMM');
