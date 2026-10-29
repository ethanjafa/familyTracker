/** Reminders live in the iPhone and Android apps; the web app doesn't schedule any. */
export type Reminders = { morning: boolean; planning: boolean; time: string };

export const loadReminders = (): Reminders => ({ morning: false, planning: false, time: '08:00' });
export const remindersOn = (r: Reminders) => r.morning || r.planning;
export const setReminders = async (_r: Reminders, _planningDay: number) => false;
export const refreshReminders = async (_planningDay: number) => {};
