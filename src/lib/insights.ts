import { endOfDay, format, getDay, startOfDay, subDays } from 'date-fns';

import { toDay, weekStart } from '@/lib/dates';
import { isFixedDueOn, isFlexible } from '@/lib/schedule';
import { type LogIndex, pct, scoreRoutine, scoreRoutines, streak } from '@/lib/scoring';
import type { Routine } from '@/lib/types';

export type Insight = {
  id: string;
  tone: 'good' | 'warn' | 'info';
  icon: string;
  title: string;
  body?: string;
};

type ProjectSignal = { name: string; stalled: boolean; idleDays: number; overdue: number };

/** Rule-based coaching feedback. Order = priority. */
export function buildInsights(
  routines: Routine[],
  logs: LogIndex,
  projects: ProjectSignal[],
  now = new Date(),
): Insight[] {
  const out: Insight[] = [];
  if (routines.length === 0 && projects.length === 0) {
    return [{ id: 'empty', tone: 'info', icon: '🌱', title: 'Add a few routines to start getting feedback.' }];
  }

  // 1. This week vs last week.
  const thisWeek = scoreRoutines(routines, logs, weekStart(now), now, now);
  const lastWeekStart = weekStart(subDays(weekStart(now), 1));
  const lastWeek = scoreRoutines(routines, logs, lastWeekStart, subDays(weekStart(now), 1), now);
  const cur = pct(thisWeek);
  const prev = pct(lastWeek);
  if (cur === 100 && thisWeek.expected >= 3) {
    out.push({ id: 'perfect', tone: 'good', icon: '🏆', title: 'Perfect week so far!', body: 'Every planned routine is done. Keep the chain going.' });
  } else if (cur !== null && prev !== null && Math.abs(cur - prev) >= 5) {
    out.push(
      cur > prev
        ? { id: 'trend', tone: 'good', icon: '📈', title: `Up ${cur - prev} points on last week`, body: `${cur}% this week vs ${prev}% last week.` }
        : { id: 'trend', tone: 'warn', icon: '📉', title: `Down ${prev - cur} points on last week`, body: `${cur}% this week vs ${prev}% last week. A small win today turns it around.` },
    );
  }

  // 2. Never miss twice.
  const yesterday = subDays(now, 1);
  const missed = routines.filter(
    (r) =>
      !isFlexible(r.schedule) &&
      isFixedDueOn(r, startOfDay(yesterday)) &&
      !logs.get(r.id)?.has(toDay(yesterday)) &&
      !logs.get(r.id)?.has(toDay(now)),
  );
  if (missed.length) {
    out.push({
      id: 'miss-twice',
      tone: 'warn',
      icon: '⛓️',
      title: "Don't miss twice",
      body: `Missed yesterday: ${missed.slice(0, 3).map((r) => r.name).join(', ')}${missed.length > 3 ? '…' : ''}. Missing once is an accident; twice starts a new habit.`,
    });
  }

  // 3. Routines that slipped: last 14 days vs the 14 before.
  for (const r of routines) {
    const recent = pct(scoreRoutine(r, logs, subDays(now, 13), now, now));
    const before = pct(scoreRoutine(r, logs, subDays(now, 27), endOfDay(subDays(now, 14)), now));
    if (recent !== null && before !== null && before >= 60 && before - recent >= 25) {
      out.push({ id: `slip-${r.id}`, tone: 'warn', icon: '⚠️', title: `${r.name} is slipping`, body: `${before}% → ${recent}% over the last two weeks.` });
    }
  }

  // 4. Best streak.
  const best = routines
    .map((r) => ({ r, s: streak(r, logs, now) }))
    .sort((a, b) => b.s - a.s)[0];
  if (best && best.s >= 3) {
    const unit = isFlexible(best.r.schedule) ? (best.r.schedule.type === 'monthly' ? 'months' : 'weeks') : 'times';
    out.push({ id: 'streak', tone: 'good', icon: '🔥', title: `${best.r.name}: ${best.s} ${unit} in a row`, body: 'Protect this streak.' });
  }

  // 5. Weakest weekday over the last 4 weeks.
  const fixed = routines.filter((r) => !isFlexible(r.schedule));
  const byWeekday = Array.from({ length: 7 }, () => ({ expected: 0, achieved: 0 }));
  for (let i = 1; i <= 28; i++) {
    const d = startOfDay(subDays(now, i));
    const s = scoreRoutines(fixed, logs, d, endOfDay(d), now);
    byWeekday[getDay(d)].expected += s.expected;
    byWeekday[getDay(d)].achieved += s.achieved;
  }
  const rated = byWeekday
    .map((s, day) => ({ day, p: s.expected >= 4 ? pct(s) : null }))
    .filter((x): x is { day: number; p: number } => x.p !== null)
    .sort((a, b) => a.p - b.p);
  if (rated.length >= 4) {
    const worst = rated[0];
    const bestDay = rated[rated.length - 1];
    if (worst.p < 70 && bestDay.p - worst.p >= 25) {
      const name = format(new Date(2026, 0, 4 + worst.day), 'EEEE'); // Jan 4 2026 is a Sunday
      out.push({
        id: 'weekday',
        tone: 'info',
        icon: '📅',
        title: `${name}s are your weakest day (${worst.p}%)`,
        body: `Your best day is at ${bestDay.p}%. Plan ${name}s the evening before.`,
      });
    }
  }

  // 6. Projects.
  for (const p of projects) {
    if (p.stalled) {
      out.push({ id: `stall-${p.name}`, tone: 'warn', icon: '🐢', title: `${p.name} hasn't moved in ${p.idleDays} days`, body: 'Pick one small next step and schedule it.' });
    } else if (p.overdue) {
      out.push({ id: `overdue-${p.name}`, tone: 'warn', icon: '⏰', title: `${p.name}: ${p.overdue} overdue step${p.overdue > 1 ? 's' : ''}`, body: 'Reschedule or do it. Overdue tasks drain motivation.' });
    }
  }

  if (out.length === 0) {
    out.push({ id: 'steady', tone: 'good', icon: '👍', title: 'Steady progress', body: 'No warning signs. Keep showing up.' });
  }
  return out;
}
