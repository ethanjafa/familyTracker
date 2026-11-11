import { toDay } from '@/lib/dates';
import {
  assigneesOn,
  completedBetween,
  cycleDay,
  dayKey,
  describeSchedule,
  flexibleTarget,
  hasDayAssignees,
  isDayAssignee,
  isDueToday,
  isFixedDueOn,
  isFlexible,
  logValue,
  periodEnd,
  periodLength,
  periodName,
  periodStart,
  plannedOn,
  scheduleWeekdays,
  usualAssigneesOn,
  usualDueOn,
  wasPlannedOn,
} from '@/lib/schedule';

import { day, log, plans, routine } from './factories';

// November 2026: the 2nd, 9th, 16th are Mondays; the 10th is a Tuesday; the 15th is a Sunday.

describe('describeSchedule', () => {
  it('describes every kind of schedule', () => {
    expect(describeSchedule({ type: 'daily' })).toBe('Every day');
    expect(describeSchedule({ type: 'weekdays', days: [0, 5, 1] })).toBe('Mon, Fri, Sun');
    expect(describeSchedule({ type: 'weekly', times: 3 })).toBe('3× a week');
    expect(describeSchedule({ type: 'biweekly', times: 1 })).toBe('1× every 2 weeks');
    expect(describeSchedule({ type: 'monthly', times: 2 })).toBe('2× a month');
    expect(describeSchedule({ type: 'interval', every: 1 })).toBe('Every day');
    expect(describeSchedule({ type: 'interval', every: 3 })).toBe('Every 3 days');
  });
});

describe('schedule kinds', () => {
  it('treats times-per-period schedules as flexible', () => {
    expect(isFlexible({ type: 'weekly', times: 2 })).toBe(true);
    expect(isFlexible({ type: 'biweekly', times: 1 })).toBe(true);
    expect(isFlexible({ type: 'monthly', times: 1 })).toBe(true);
    expect(isFlexible({ type: 'daily' })).toBe(false);
    expect(isFlexible({ type: 'weekdays', days: [1] })).toBe(false);
    expect(isFlexible({ type: 'interval', every: 2 })).toBe(false);
  });

  it('knows which weekdays a schedule is tied to', () => {
    expect(scheduleWeekdays({ type: 'daily' })).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(scheduleWeekdays({ type: 'weekdays', days: [1, 4] })).toEqual([1, 4]);
    expect(scheduleWeekdays({ type: 'weekly', times: 2, days: [2] })).toEqual([2]);
    expect(scheduleWeekdays({ type: 'weekly', times: 2 })).toBeNull();
    expect(scheduleWeekdays({ type: 'weekly', times: 2, days: [] })).toBeNull();
    expect(scheduleWeekdays({ type: 'monthly', times: 1 })).toBeNull();
    expect(scheduleWeekdays({ type: 'interval', every: 2 })).toBeNull();
  });

  it('reads targets and period names', () => {
    expect(flexibleTarget({ type: 'weekly', times: 3 })).toBe(3);
    expect(flexibleTarget({ type: 'daily' })).toBe(1);
    expect(periodName({ type: 'weekly', times: 1 })).toBe('week');
    expect(periodName({ type: 'biweekly', times: 1 })).toBe('2 weeks');
    expect(periodName({ type: 'monthly', times: 1 })).toBe('month');
  });
});

describe('usualDueOn', () => {
  it('is never due before the start date', () => {
    const r = routine({ start_date: '2026-11-04' });
    expect(usualDueOn(r, day('2026-11-03'))).toBe(false);
    expect(usualDueOn(r, day('2026-11-04'))).toBe(true);
  });

  it('follows picked weekdays', () => {
    const r = routine({ schedule: { type: 'weekdays', days: [1, 4] } });
    expect(usualDueOn(r, day('2026-11-09'))).toBe(true); // Mon
    expect(usualDueOn(r, day('2026-11-10'))).toBe(false); // Tue
    expect(usualDueOn(r, day('2026-11-12'))).toBe(true); // Thu
  });

  it('puts times-a-week routines only on their default days, if any', () => {
    expect(usualDueOn(routine({ schedule: { type: 'weekly', times: 2 } }), day('2026-11-10'))).toBe(false);
    const withDays = routine({ schedule: { type: 'weekly', times: 2, days: [2] } });
    expect(usualDueOn(withDays, day('2026-11-10'))).toBe(true);
    expect(usualDueOn(withDays, day('2026-11-11'))).toBe(false);
  });

  it('counts every-N-days from the start date', () => {
    const r = routine({ schedule: { type: 'interval', every: 3 }, start_date: '2026-11-01' });
    const due = ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-07'].map((d) => usualDueOn(r, day(d)));
    expect(due).toEqual([true, false, false, true, true]);
  });

  it('treats a broken interval of 0 as every day instead of crashing', () => {
    const r = routine({ schedule: { type: 'interval', every: 0 }, start_date: '2026-11-01' });
    expect(usualDueOn(r, day('2026-11-02'))).toBe(true);
  });

  it('never places monthly routines on a specific day', () => {
    expect(usualDueOn(routine({ schedule: { type: 'monthly', times: 2 } }), day('2026-11-10'))).toBe(false);
  });

  it('follows the two-week cycle for every-2-weeks routines', () => {
    // Started Wed 4 Nov, so the cycle starts Mon 2 Nov. Day 0 = first Monday, day 8 = second Tuesday.
    const r = routine({ schedule: { type: 'biweekly', times: 2, days: [0, 8] }, start_date: '2026-11-04' });
    expect(usualDueOn(r, day('2026-11-02'))).toBe(false); // cycle day 0, but before the start date
    expect(usualDueOn(r, day('2026-11-09'))).toBe(false); // second Monday
    expect(usualDueOn(r, day('2026-11-10'))).toBe(true); // second Tuesday
    expect(usualDueOn(r, day('2026-11-16'))).toBe(true); // next cycle's first Monday
    expect(usualDueOn(r, day('2026-11-17'))).toBe(false);
    expect(usualDueOn(r, day('2026-11-24'))).toBe(true);
  });
});

describe('two-week cycle', () => {
  const r = routine({ schedule: { type: 'biweekly', times: 1 }, start_date: '2026-11-04' });

  it('numbers days 0–13 from the Monday of the start week', () => {
    expect(cycleDay(r, day('2026-11-02'))).toBe(0);
    expect(cycleDay(r, day('2026-11-15'))).toBe(13);
    expect(cycleDay(r, day('2026-11-16'))).toBe(0);
  });

  it('stays within 0–13 for days before the start', () => {
    expect(cycleDay(r, day('2026-10-26'))).toBe(7);
    expect(cycleDay(r, day('2026-11-01'))).toBe(13);
  });

  it('keys default owners by cycle day, and by weekday for other schedules', () => {
    expect(dayKey(r, day('2026-11-10'))).toBe('b8');
    expect(dayKey(routine(), day('2026-11-10'))).toBe('2');
    expect(dayKey(routine(), day('2026-11-15'))).toBe('0');
  });
});

describe('who does it', () => {
  it('uses the routine owners when nobody is set per day', () => {
    const r = routine({ assignee_ids: ['ana', 'ben'] });
    expect(hasDayAssignees(r)).toBe(false);
    expect(usualAssigneesOn(r, day('2026-11-10'))).toEqual(['ana', 'ben']);
  });

  it('takes turns by weekday', () => {
    const r = routine({
      schedule: { type: 'weekdays', days: [1, 4] },
      assignee_ids: ['ana'],
      day_assignees: { '1': 'ana', '4': 'ben' },
    });
    expect(hasDayAssignees(r)).toBe(true);
    expect(usualAssigneesOn(r, day('2026-11-09'))).toEqual(['ana']);
    expect(usualAssigneesOn(r, day('2026-11-12'))).toEqual(['ben']);
    expect(usualAssigneesOn(r, day('2026-11-10'))).toEqual([]); // nobody set for Tuesday
    expect(isDayAssignee(r, 'ben')).toBe(true);
    expect(isDayAssignee(r, 'cat')).toBe(false);
  });

  it('ignores per-day owners on schedules without default days', () => {
    const r = routine({ schedule: { type: 'weekly', times: 2 }, assignee_ids: ['ana'], day_assignees: { '1': 'ben' } });
    expect(hasDayAssignees(r)).toBe(false);
    expect(usualAssigneesOn(r, day('2026-11-09'))).toEqual(['ana']);
    expect(isDayAssignee(r, 'ben')).toBe(false);
  });

  it('takes turns across a two-week cycle', () => {
    const r = routine({
      schedule: { type: 'biweekly', times: 2, days: [0, 8] },
      start_date: '2026-11-02',
      day_assignees: { b0: 'ana', b8: 'ben' },
    });
    expect(usualAssigneesOn(r, day('2026-11-02'))).toEqual(['ana']);
    expect(usualAssigneesOn(r, day('2026-11-10'))).toEqual(['ben']);
  });

  it('lets a swap made in Plan win for that day only', () => {
    const r = routine({ assignee_ids: ['ana'], plans: plans('r1', { '2026-11-10': { planned: true, assignee_id: 'ben' } }) });
    expect(assigneesOn(r, day('2026-11-10'))).toEqual(['ben']);
    expect(assigneesOn(r, day('2026-11-11'))).toEqual(['ana']);
  });

  it('keeps the usual people when a plan has no person', () => {
    const r = routine({ assignee_ids: ['ana'], plans: plans('r1', { '2026-11-10': { planned: true } }) });
    expect(assigneesOn(r, day('2026-11-10'))).toEqual(['ana']);
  });
});

describe('plannedOn', () => {
  it('follows the schedule unless that day was planned differently', () => {
    const r = routine({
      schedule: { type: 'weekdays', days: [1] },
      plans: plans('r1', { '2026-11-09': { planned: false }, '2026-11-10': { planned: true } }),
    });
    expect(plannedOn(r, day('2026-11-09'))).toBe(false); // Monday taken off
    expect(plannedOn(r, day('2026-11-10'))).toBe(true); // Tuesday added
    expect(plannedOn(r, day('2026-11-16'))).toBe(true); // next Monday as usual
  });

  it("narrows to one person's days when scoring for them", () => {
    const r = routine({ day_assignees: { '1': 'ana', '2': 'ben' }, scoredFor: 'ana' });
    expect(isFixedDueOn(r, day('2026-11-09'))).toBe(true);
    expect(isFixedDueOn(r, day('2026-11-10'))).toBe(false);
    const swapped = { ...r, plans: plans('r1', { '2026-11-10': { planned: true, assignee_id: 'ana' } }) };
    expect(isFixedDueOn(swapped, day('2026-11-10'))).toBe(true);
  });
});

describe('periods', () => {
  it('counts weekly targets Monday to Sunday', () => {
    const r = routine({ schedule: { type: 'weekly', times: 2 } });
    const start = periodStart(r, day('2026-11-10'));
    expect(toDay(start)).toBe('2026-11-09');
    expect(toDay(periodEnd(r, start))).toBe('2026-11-15');
    expect(periodLength(r, start)).toBe(7);
  });

  it('counts monthly targets over the calendar month', () => {
    const r = routine({ schedule: { type: 'monthly', times: 2 } });
    const start = periodStart(r, day('2026-11-10'));
    expect(toDay(start)).toBe('2026-11-01');
    expect(toDay(periodEnd(r, start))).toBe('2026-11-30');
    expect(periodLength(r, start)).toBe(30);
    expect(periodLength(r, day('2028-02-01'))).toBe(29); // leap year
  });

  it('counts every-2-weeks targets over the cycle that began in the start week', () => {
    const r = routine({ schedule: { type: 'biweekly', times: 1 }, start_date: '2026-11-04' });
    const start = periodStart(r, day('2026-11-10'));
    expect(toDay(start)).toBe('2026-11-02');
    expect(toDay(periodEnd(r, start))).toBe('2026-11-15');
    expect(periodLength(r, start)).toBe(14);
    expect(toDay(periodStart(r, day('2026-11-17')))).toBe('2026-11-16');
  });
});

describe('logs', () => {
  it('values done, partial, skipped and missing', () => {
    expect(logValue(log('r1', '2026-11-09', 'done'))).toBe(1);
    expect(logValue(log('r1', '2026-11-09', 'partial'))).toBe(0.5);
    expect(logValue(log('r1', '2026-11-09', 'skipped'))).toBeNull();
    expect(logValue(undefined)).toBe(0);
  });

  it('adds up what was done in a range, both ends included', () => {
    const logs = new Map([
      ['2026-11-08', log('r1', '2026-11-08')],
      ['2026-11-09', log('r1', '2026-11-09')],
      ['2026-11-10', log('r1', '2026-11-10', 'partial')],
      ['2026-11-11', log('r1', '2026-11-11', 'skipped')],
      ['2026-11-15', log('r1', '2026-11-15')],
    ]);
    expect(completedBetween(logs, day('2026-11-09'), day('2026-11-15'))).toBe(2.5);
    expect(completedBetween(undefined, day('2026-11-09'), day('2026-11-15'))).toBe(0);
  });
});

describe('isDueToday', () => {
  const logsOn = (...days: string[]) => new Map(days.map((d) => [d, log('r1', d)]));

  it('never shows archived routines', () => {
    expect(isDueToday(routine({ archived_at: '2026-11-01T00:00:00Z' }), undefined, day('2026-11-10'))).toBe(false);
  });

  it('shows fixed routines on their days', () => {
    const r = routine({ schedule: { type: 'weekdays', days: [2] } });
    expect(isDueToday(r, undefined, day('2026-11-10'))).toBe(true);
    expect(isDueToday(r, undefined, day('2026-11-11'))).toBe(false);
  });

  it("shows a times-a-week routine until the week's target is met", () => {
    const r = routine({ schedule: { type: 'weekly', times: 2 } });
    expect(isDueToday(r, undefined, day('2026-11-10'))).toBe(true);
    expect(isDueToday(r, logsOn('2026-11-09'), day('2026-11-10'))).toBe(true);
    expect(isDueToday(r, logsOn('2026-11-09', '2026-11-10'), day('2026-11-11'))).toBe(false);
  });

  it("doesn't count last week's check-ins towards this week", () => {
    const r = routine({ schedule: { type: 'weekly', times: 1 } });
    expect(isDueToday(r, logsOn('2026-11-08'), day('2026-11-09'))).toBe(true);
  });

  it('keeps a routine on the list on the day it was logged', () => {
    const r = routine({ schedule: { type: 'weekly', times: 1 } });
    expect(isDueToday(r, logsOn('2026-11-10'), day('2026-11-10'))).toBe(true);
  });

  it('hides flexible routines before their start date', () => {
    const r = routine({ schedule: { type: 'weekly', times: 1 }, start_date: '2026-11-11' });
    expect(isDueToday(r, undefined, day('2026-11-10'))).toBe(false);
  });

  it('shows a flexible routine only on its default days once it has some', () => {
    const r = routine({ schedule: { type: 'weekly', times: 2, days: [2] } });
    expect(isDueToday(r, undefined, day('2026-11-10'))).toBe(true);
    expect(isDueToday(r, undefined, day('2026-11-11'))).toBe(false);
  });

  it('shows a flexible routine on the day it was placed on in Plan', () => {
    const r = routine({ schedule: { type: 'weekly', times: 2 }, plans: plans('r1', { '2026-11-12': { planned: true } }) });
    expect(isDueToday(r, undefined, day('2026-11-10'))).toBe(false);
    expect(isDueToday(r, undefined, day('2026-11-12'))).toBe(true);
    // The week after has no placed days, so it is back to "until the target is met".
    expect(isDueToday(r, undefined, day('2026-11-17'))).toBe(true);
  });
});

describe('wasPlannedOn (catching up on missed days)', () => {
  it('counts fixed routines on their days', () => {
    const r = routine({ schedule: { type: 'weekdays', days: [2] } });
    expect(wasPlannedOn(r, day('2026-11-10'))).toBe(true);
    expect(wasPlannedOn(r, day('2026-11-11'))).toBe(false);
  });

  it('counts flexible routines only on days they were placed on', () => {
    expect(wasPlannedOn(routine({ schedule: { type: 'weekly', times: 2 } }), day('2026-11-10'))).toBe(false);
    const placed = routine({ schedule: { type: 'weekly', times: 2, days: [2] } });
    expect(wasPlannedOn(placed, day('2026-11-10'))).toBe(true);
    expect(wasPlannedOn(placed, day('2026-11-11'))).toBe(false);
  });

  it('ignores archived routines and days before the start', () => {
    expect(wasPlannedOn(routine({ archived_at: '2026-11-01T00:00:00Z' }), day('2026-11-10'))).toBe(false);
    expect(wasPlannedOn(routine({ start_date: '2026-11-11' }), day('2026-11-10'))).toBe(false);
  });
});
