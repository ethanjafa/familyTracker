import { fromDay, prettyDay, toDay, weekDays, weekRange, weekStart } from '@/lib/dates';

describe('dates', () => {
  it('round-trips a calendar day without shifting it', () => {
    expect(toDay(fromDay('2026-11-10'))).toBe('2026-11-10');
    expect(toDay(new Date(2026, 0, 1, 23, 59))).toBe('2026-01-01');
  });

  it('starts weeks on Monday', () => {
    // 10 Nov 2026 is a Tuesday.
    expect(toDay(weekStart(new Date(2026, 10, 10)))).toBe('2026-11-09');
    // A Sunday belongs to the week that started the Monday before.
    expect(toDay(weekStart(new Date(2026, 10, 15)))).toBe('2026-11-09');
    expect(toDay(weekStart(new Date(2026, 10, 9)))).toBe('2026-11-09');
  });

  it('lists the seven days of a week, Monday to Sunday', () => {
    const days = weekDays(weekStart(new Date(2026, 10, 10))).map(toDay);
    expect(days).toHaveLength(7);
    expect(days[0]).toBe('2026-11-09');
    expect(days[6]).toBe('2026-11-15');
  });

  it('formats days and week ranges for display', () => {
    expect(prettyDay('2026-11-10')).toBe('Tue 10 Nov');
    expect(weekRange(new Date(2026, 9, 26))).toBe('Oct 26 – Nov 1');
  });
});
