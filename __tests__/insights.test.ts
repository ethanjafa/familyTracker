import { buildInsights } from '@/lib/insights';
import { indexLogs } from '@/lib/scoring';

import { at, doneOn, routine } from './factories';

// Thursday 12 Nov 2026, 3 pm. This week: Mon 9 – Sun 15. Last week: Mon 2 – Sun 8.
const NOW = at('2026-11-12');
const ids = (list: { id: string }[]) => list.map((i) => i.id);

describe('buildInsights', () => {
  it('invites you to add routines when there is nothing yet', () => {
    expect(ids(buildInsights([], indexLogs([]), [], NOW))).toEqual(['empty']);
  });

  it('says "steady" when there is nothing to flag', () => {
    const fresh = routine({ start_date: '2026-11-12' });
    expect(ids(buildInsights([fresh], indexLogs([]), [], NOW))).toEqual(['steady']);
  });

  it('celebrates a perfect week and the streak behind it', () => {
    const r = routine({ start_date: '2026-11-09' });
    const insights = buildInsights([r], doneOn('r1', '2026-11-09', '2026-11-10', '2026-11-11'), [], NOW);
    expect(ids(insights)).toEqual(['perfect', 'streak']);
    expect(insights[1].title).toBe('Dishes: 3 times in a row');
  });

  it('compares this week with last week', () => {
    const r = routine({ start_date: '2026-11-02' });
    // Last week 1 of 7 (14%); this week 2 of 3 (67%).
    const up = buildInsights([r], doneOn('r1', '2026-11-02', '2026-11-09', '2026-11-10'), [], NOW);
    const trend = up.find((i) => i.id === 'trend');
    expect(trend).toMatchObject({ tone: 'good', title: 'Up 53 points on last week' });

    // Last week 7 of 7; this week 1 of 3 (33%).
    const lastWeek = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08'];
    const down = buildInsights([r], doneOn('r1', ...lastWeek, '2026-11-09'), [], NOW);
    expect(down.find((i) => i.id === 'trend')).toMatchObject({ tone: 'warn', title: 'Down 67 points on last week' });
  });

  it('warns not to miss twice, naming up to three routines', () => {
    const names = ['Dishes', 'Trash', 'Laundry', 'Plants'];
    const routines = names.map((name, i) => routine({ id: `r${i}`, name, start_date: '2026-11-11' }));
    const miss = buildInsights(routines, indexLogs([]), [], NOW).find((i) => i.id === 'miss-twice');
    expect(miss?.body).toContain('Dishes, Trash, Laundry…');
    expect(miss?.body).not.toContain('Plants');
  });

  it("doesn't nag about yesterday once today is done", () => {
    const r = routine({ start_date: '2026-11-11' });
    expect(ids(buildInsights([r], doneOn('r1', '2026-11-12'), [], NOW))).not.toContain('miss-twice');
  });

  it('flags a routine that slipped over the last two weeks', () => {
    const r = routine({ id: 'gym', name: 'Gym', start_date: '2026-10-01' });
    // Done every day from 16 to 29 Oct (the earlier two weeks), then nothing.
    const earlier = Array.from({ length: 14 }, (_, i) => `2026-10-${16 + i}`);
    const slip = buildInsights([r], doneOn('gym', ...earlier), [], NOW).find((i) => i.id === 'slip-gym');
    expect(slip).toMatchObject({ tone: 'warn', title: 'Gym is slipping', body: '100% → 0% over the last two weeks.' });
  });

  it('reports to-dos still open from earlier days', () => {
    const insights = buildInsights([], indexLogs([]), [{ name: 'Home', overdue: 2 }, { name: 'Car', overdue: 1 }, { name: 'Fine', overdue: 0 }], NOW);
    expect(ids(insights)).toEqual(['overdue-Home', 'overdue-Car']);
    expect(insights[0].title).toBe('Home: 2 to-dos still open from earlier days');
    expect(insights[1].title).toBe('Car: 1 to-do still open from earlier days');
  });
});
