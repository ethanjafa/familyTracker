import {
  band,
  creditByPerson,
  familyRoutines,
  indexLogs,
  pct,
  routinesFor,
  scoreRoutine,
  scoreRoutines,
  streak,
} from '@/lib/scoring';

import { at, category, day, doneOn, log, plans, routine } from './factories';

// "Now" is Thursday 12 Nov 2026, 3 pm. The week runs Mon 9 – Sun 15.
const NOW = at('2026-11-12');
const MON = day('2026-11-09');
const SUN = day('2026-11-15');

describe('pct and band', () => {
  it('turns a score into a rounded percentage', () => {
    expect(pct({ expected: 3, achieved: 2 })).toBe(67);
    expect(pct({ expected: 4, achieved: 4 })).toBe(100);
    expect(pct({ expected: 4, achieved: 0 })).toBe(0);
  });

  it('has no percentage when nothing was expected', () => {
    expect(pct({ expected: 0, achieved: 0 })).toBeNull();
  });

  it('bands scores at 80 and 50', () => {
    expect(band(null)).toBe('none');
    expect(band(100)).toBe('good');
    expect(band(80)).toBe('good');
    expect(band(79)).toBe('ok');
    expect(band(50)).toBe('ok');
    expect(band(49)).toBe('bad');
  });
});

describe('indexLogs', () => {
  it('groups logs by routine, then by day', () => {
    const index = indexLogs([log('a', '2026-11-09'), log('a', '2026-11-10'), log('b', '2026-11-09')]);
    expect(index.get('a')?.size).toBe(2);
    expect(index.get('b')?.get('2026-11-09')?.status).toBe('done');
    expect(index.get('c')).toBeUndefined();
  });
});

describe('scoreRoutine: fixed schedules', () => {
  const r = routine({ start_date: '2026-11-01' });

  it('counts a missed day against you', () => {
    expect(scoreRoutine(r, indexLogs([]), MON, SUN, NOW)).toEqual({ expected: 3, achieved: 0 });
  });

  it("doesn't count today until it is logged", () => {
    const logs = doneOn('r1', '2026-11-09', '2026-11-10', '2026-11-11');
    expect(scoreRoutine(r, logs, MON, SUN, NOW)).toEqual({ expected: 3, achieved: 3 });
    const withToday = doneOn('r1', '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12');
    expect(scoreRoutine(r, withToday, MON, SUN, NOW)).toEqual({ expected: 4, achieved: 4 });
  });

  it('never counts future days', () => {
    const logs = doneOn('r1', '2026-11-09');
    expect(scoreRoutine(r, logs, MON, day('2026-12-31'), NOW).expected).toBe(3);
  });

  it('gives half for partial and excuses skipped days', () => {
    const logs = indexLogs([log('r1', '2026-11-09'), log('r1', '2026-11-10', 'partial'), log('r1', '2026-11-11', 'skipped')]);
    const score = scoreRoutine(r, logs, MON, SUN, NOW);
    expect(score).toEqual({ expected: 2, achieved: 1.5 });
    expect(pct(score)).toBe(75);
  });

  it('only counts days the routine is on', () => {
    const tuesdays = routine({ schedule: { type: 'weekdays', days: [2] }, start_date: '2026-11-01' });
    expect(scoreRoutine(tuesdays, indexLogs([]), MON, SUN, NOW)).toEqual({ expected: 1, achieved: 0 });
  });

  it('starts counting at the start date', () => {
    const fresh = routine({ start_date: '2026-11-11' });
    expect(scoreRoutine(fresh, indexLogs([]), MON, SUN, NOW)).toEqual({ expected: 1, achieved: 0 });
  });

  it('expects nothing for a range that has not started', () => {
    expect(scoreRoutine(r, indexLogs([]), day('2026-11-16'), day('2026-11-22'), NOW)).toEqual({ expected: 0, achieved: 0 });
    expect(scoreRoutine(routine({ start_date: '2026-12-01' }), indexLogs([]), MON, SUN, NOW)).toEqual({ expected: 0, achieved: 0 });
  });

  it('respects days taken off or added in Plan', () => {
    const planned = routine({
      schedule: { type: 'weekdays', days: [1] },
      start_date: '2026-11-01',
      plans: plans('r1', { '2026-11-09': { planned: false }, '2026-11-10': { planned: true } }),
    });
    const logs = doneOn('r1', '2026-11-10');
    expect(scoreRoutine(planned, logs, MON, SUN, NOW)).toEqual({ expected: 1, achieved: 1 });
  });

  it("only counts a person's own days when narrowed to them", () => {
    const turns = routine({ start_date: '2026-11-01', day_assignees: { '1': 'ana', '2': 'ben', '3': 'ana' }, scoredFor: 'ana' });
    // Mon and Wed are Ana's; Tue is Ben's.
    expect(scoreRoutine(turns, doneOn('r1', '2026-11-09'), MON, SUN, NOW)).toEqual({ expected: 2, achieved: 1 });
  });
});

describe('scoreRoutine: times-per-period schedules', () => {
  const r = routine({ schedule: { type: 'weekly', times: 3 }, start_date: '2026-10-01' });

  it('expects the full target for a week that is over', () => {
    const logs = doneOn('r1', '2026-11-03', '2026-11-05');
    const score = scoreRoutine(r, logs, day('2026-11-02'), day('2026-11-08'), NOW);
    expect(score).toEqual({ expected: 3, achieved: 2 });
    expect(pct(score)).toBe(67);
  });

  it('caps extra check-ins at the target', () => {
    const logs = doneOn('r1', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06');
    expect(scoreRoutine(r, logs, day('2026-11-02'), day('2026-11-08'), NOW)).toEqual({ expected: 3, achieved: 3 });
  });

  it('prorates the target over the days that have passed, leaving today out', () => {
    // Mon–Wed have passed: 3 of 7 days of a 3×-a-week target.
    const score = scoreRoutine(r, indexLogs([]), MON, SUN, NOW);
    expect(score.expected).toBeCloseTo(9 / 7);
    expect(score.achieved).toBe(0);
  });

  it("counts today's check-in even though today isn't expected yet", () => {
    const score = scoreRoutine(r, doneOn('r1', '2026-11-12'), MON, SUN, NOW);
    expect(score.achieved).toBe(1);
    expect(pct(score)).toBe(78);
  });

  it('is 100% when you are ahead of the prorated target', () => {
    expect(pct(scoreRoutine(r, doneOn('r1', '2026-11-09', '2026-11-10'), MON, SUN, NOW))).toBe(100);
  });

  it('expects nothing on the first day of a week', () => {
    const monday = at('2026-11-09');
    expect(scoreRoutine(r, indexLogs([]), MON, SUN, monday).expected).toBe(0);
  });

  it('scores monthly targets over the calendar month', () => {
    const monthly = routine({ schedule: { type: 'monthly', times: 4 }, start_date: '2026-09-01' });
    const logs = doneOn('r1', '2026-10-03', '2026-10-20');
    expect(scoreRoutine(monthly, logs, day('2026-10-01'), day('2026-10-31'), NOW)).toEqual({ expected: 4, achieved: 2 });
  });

  it('scores every-2-weeks targets over the two-week cycle', () => {
    const biweekly = routine({ schedule: { type: 'biweekly', times: 2 }, start_date: '2026-10-05' }); // a Monday
    const logs = doneOn('r1', '2026-10-06');
    expect(scoreRoutine(biweekly, logs, day('2026-10-05'), day('2026-10-18'), NOW)).toEqual({ expected: 2, achieved: 1 });
  });
});

describe('scoreRoutines', () => {
  it('adds routines up, each counting the same', () => {
    const a = routine({ id: 'a', start_date: '2026-11-01' });
    const b = routine({ id: 'b', start_date: '2026-11-01' });
    const logs = indexLogs([log('a', '2026-11-09'), log('a', '2026-11-10'), log('a', '2026-11-11'), log('b', '2026-11-09')]);
    const score = scoreRoutines([a, b], logs, MON, SUN, NOW);
    expect(score).toEqual({ expected: 6, achieved: 4 });
    expect(pct(score)).toBe(67);
  });

  it('is empty for no routines', () => {
    expect(pct(scoreRoutines([], indexLogs([]), MON, SUN, NOW))).toBeNull();
  });
});

describe('creditByPerson', () => {
  it('credits the owner of the day, whoever ticked it off', () => {
    const r = routine({ assignee_ids: ['ana'] });
    const credit = creditByPerson([r], indexLogs([log('r1', '2026-11-09', 'done', 'ben')]), MON, SUN);
    expect([...credit]).toEqual([['ana', 1]]);
  });

  it('splits shared routines evenly', () => {
    const r = routine({ assignee_ids: ['ana', 'ben'] });
    const credit = creditByPerson([r], doneOn('r1', '2026-11-09'), MON, SUN);
    expect(credit.get('ana')).toBe(0.5);
    expect(credit.get('ben')).toBe(0.5);
  });

  it('credits whoever did it when nobody owns the routine', () => {
    const credit = creditByPerson([routine()], indexLogs([log('r1', '2026-11-09', 'done', 'cat')]), MON, SUN);
    expect([...credit]).toEqual([['cat', 1]]);
  });

  it('follows turn-taking and swaps made in Plan', () => {
    const r = routine({
      day_assignees: { '1': 'ana', '2': 'ben' },
      plans: plans('r1', { '2026-11-10': { planned: true, assignee_id: 'ana' } }),
    });
    const credit = creditByPerson([r], doneOn('r1', '2026-11-09', '2026-11-10'), MON, SUN);
    expect([...credit]).toEqual([['ana', 2]]);
  });

  it('gives half for partial, nothing for skipped, and ignores days outside the range', () => {
    const r = routine({ assignee_ids: ['ana'] });
    const logs = indexLogs([
      log('r1', '2026-11-08'),
      log('r1', '2026-11-09', 'partial'),
      log('r1', '2026-11-10', 'skipped'),
      log('r1', '2026-11-16'),
    ]);
    expect([...creditByPerson([r], logs, MON, SUN)]).toEqual([['ana', 0.5]]);
  });
});

describe('streak', () => {
  const r = routine({ start_date: '2026-11-01' });

  it('counts back from yesterday while today is still open', () => {
    expect(streak(r, doneOn('r1', '2026-11-09', '2026-11-10', '2026-11-11'), NOW)).toBe(3);
  });

  it('includes today once it is logged', () => {
    expect(streak(r, doneOn('r1', '2026-11-10', '2026-11-11', '2026-11-12'), NOW)).toBe(3);
  });

  it('breaks on a missed day', () => {
    expect(streak(r, doneOn('r1', '2026-11-08', '2026-11-09', '2026-11-11'), NOW)).toBe(1);
    expect(streak(r, doneOn('r1', '2026-11-09', '2026-11-10'), NOW)).toBe(0);
    expect(streak(r, indexLogs([]), NOW)).toBe(0);
  });

  it('skipped days neither break nor extend it', () => {
    const logs = indexLogs([log('r1', '2026-11-09'), log('r1', '2026-11-10', 'skipped'), log('r1', '2026-11-11')]);
    expect(streak(r, logs, NOW)).toBe(2);
  });

  it('counts partial days', () => {
    const logs = indexLogs([log('r1', '2026-11-10', 'partial'), log('r1', '2026-11-11')]);
    expect(streak(r, logs, NOW)).toBe(2);
  });

  it('only looks at days the routine is on', () => {
    const monWed = routine({ schedule: { type: 'weekdays', days: [1, 3] }, start_date: '2026-10-01' });
    // Wed 4, Mon 9, Wed 11 done; Mon 2 missed.
    expect(streak(monWed, doneOn('r1', '2026-11-04', '2026-11-09', '2026-11-11'), NOW)).toBe(3);
  });

  it('stops at the start date', () => {
    const fresh = routine({ start_date: '2026-11-10' });
    expect(streak(fresh, doneOn('r1', '2026-11-10', '2026-11-11'), NOW)).toBe(2);
  });

  it('counts weeks for times-a-week routines, skipping the unfinished current week', () => {
    const weekly = routine({ schedule: { type: 'weekly', times: 2 }, start_date: '2026-10-01' });
    const logs = doneOn('r1', '2026-10-27', '2026-10-28', '2026-11-03', '2026-11-05', '2026-11-09');
    expect(streak(weekly, logs, NOW)).toBe(2);
  });

  it('includes the current week once its target is met', () => {
    const weekly = routine({ schedule: { type: 'weekly', times: 2 }, start_date: '2026-10-01' });
    const logs = doneOn('r1', '2026-11-03', '2026-11-05', '2026-11-09', '2026-11-10');
    expect(streak(weekly, logs, NOW)).toBe(2);
  });
});

describe('whose routines count', () => {
  const categories = new Map([
    ['c-family', category()],
    ['c-ana', category({ id: 'c-ana', visibility: 'personal', owner_id: 'ana' })],
    ['c-ben', category({ id: 'c-ben', visibility: 'personal', owner_id: 'ben' })],
  ]);

  const ids = (list: { id: string }[]) => list.map((r) => r.id);

  it('includes your personal categories, not other people’s', () => {
    const mine = routine({ id: 'mine', category_id: 'c-ana' });
    const theirs = routine({ id: 'theirs', category_id: 'c-ben' });
    const result = routinesFor('ana', [mine, theirs], categories);
    expect(ids(result)).toEqual(['mine']);
    expect(result[0].scoredFor).toBeUndefined();
  });

  it('includes family routines you are involved in, narrowed to you', () => {
    const owned = routine({ id: 'owned', assignee_ids: ['ana', 'ben'] });
    const turns = routine({ id: 'turns', day_assignees: { '1': 'ana' } });
    const swapped = routine({ id: 'swapped', assignee_ids: ['ben'], plans: plans('swapped', { '2026-11-10': { planned: true, assignee_id: 'ana' } }) });
    const notMine = routine({ id: 'not-mine', assignee_ids: ['ben'] });
    const anyone = routine({ id: 'anyone' });
    const result = routinesFor('ana', [owned, turns, swapped, notMine, anyone], categories);
    expect(ids(result)).toEqual(['owned', 'turns', 'swapped']);
    expect(result.every((r) => r.scoredFor === 'ana')).toBe(true);
  });

  it('keeps 🔒 personal routines to their owner', () => {
    const mine = routine({ id: 'mine', private_to: 'ana', assignee_ids: ['ana'] });
    const theirs = routine({ id: 'theirs', private_to: 'ben', assignee_ids: ['ben'] });
    expect(ids(routinesFor('ana', [mine, theirs], categories))).toEqual(['mine']);
  });

  it('drops routines whose category is missing', () => {
    expect(routinesFor('ana', [routine({ category_id: 'gone', assignee_ids: ['ana'] })], categories)).toEqual([]);
  });

  it('counts only shared routines towards the family score', () => {
    const shared = routine({ id: 'shared' });
    const locked = routine({ id: 'locked', private_to: 'ana' });
    const personal = routine({ id: 'personal', category_id: 'c-ana' });
    expect(ids(familyRoutines([shared, locked, personal], categories))).toEqual(['shared']);
  });
});
