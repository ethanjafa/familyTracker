import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

/**
 * Reminders are scheduled on the phone itself (no server): a morning nudge every day, and a
 * nudge on the family's planning day. The choice is per device, like any alarm.
 */
export type Reminders = { morning: boolean; planning: boolean; time: string };

/** Fixed times, so there's nothing to choose: a 9 am morning nudge, a 4 pm planning-day nudge. */
const MORNING = { hour: 9, minute: 0 };
const PLANNING = { hour: 16, minute: 0 };

const KEY = 'reminders';
const DEFAULTS: Reminders = { morning: false, planning: false, time: '08:00' };
const CHANNEL = 'reminders';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

export function loadReminders(): Reminders {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return DEFAULTS;
  }
}

// Screens showing "are reminders on?" (like Today's checklist) update the moment they change.
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

function saveReminders(r: Reminders) {
  try {
    localStorage.setItem(KEY, JSON.stringify(r));
  } catch {
    // Not remembered on this device; reminders stay as scheduled until the app reschedules them.
  }
  listeners.forEach((l) => l());
}

export const remindersOn = (r: Reminders) => r.morning || r.planning;

/** Whether any reminder is on, kept up to date as soon as it changes (e.g. in Settings). */
export function useRemindersOn() {
  return useSyncExternalStore(subscribe, () => remindersOn(loadReminders()));
}

/** Ask for permission (the first time). Returns whether reminders can be shown. */
async function allowed() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL, { name: 'Reminders', importance: AndroidImportance.DEFAULT });
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

/**
 * Save the reminder choices and (re)schedule them. Returns false when the phone doesn't allow
 * notifications, in which case nothing is turned on.
 */
export async function setReminders(r: Reminders, planningDay: number): Promise<boolean> {
  if (remindersOn(r) && !(await allowed())) return false;
  saveReminders(r);
  await schedule(r, planningDay);
  return true;
}

/** Re-apply the saved reminders, e.g. on launch or after the planning day changes. */
export async function refreshReminders(planningDay: number) {
  const r = loadReminders();
  if (!remindersOn(r)) return;
  const { granted } = await Notifications.getPermissionsAsync();
  if (granted) await schedule(r, planningDay);
}

async function schedule(r: Reminders, planningDay: number) {
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (r.morning) {
    await Notifications.scheduleNotificationAsync({
      content: { title: 'Good morning ☀️', body: "Here's what's on your list today." },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, ...MORNING, channelId: CHANNEL },
    });
  }
  if (r.planning) {
    await Notifications.scheduleNotificationAsync({
      content: { title: '⛵ It’s planning day', body: 'Plan the week together: who does what this week?' },
      // Weekdays here run 1 (Sunday) to 7 (Saturday); ours run 0 (Sunday) to 6.
      trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: planningDay + 1, ...PLANNING, channelId: CHANNEL },
    });
  }
}
