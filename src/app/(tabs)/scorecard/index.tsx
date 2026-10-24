import { addDays, format, subDays, subMonths, endOfMonth, isAfter } from 'date-fns';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { useProjectItems, useProjects } from '@/api/projects';
import { ThemedText } from '@/components/themed-text';
import { Avatar, Card, Chip, Loading, ProgressBar, Screen, ScorePill, SectionTitle, Segmented, styles, useBandColor } from '@/components/ui';
import { useRoutineData } from '@/hooks/use-routine-data';
import { useTheme } from '@/hooks/use-theme';
import { monthStart, today, weekStart } from '@/lib/dates';
import { buildInsights } from '@/lib/insights';
import { projectStats } from '@/lib/projects';
import { band, familyRoutines, pct, routinesFor, scoreRoutines, streak } from '@/lib/scoring';
import { useHousehold } from '@/providers/household-provider';

type Period = 'week' | 'month';
const FAMILY = 'family';

export default function ScorecardScreen() {
  const theme = useTheme();
  const bandColor = useBandColor();
  const { userId, members, memberById, memberColor } = useHousehold();
  const data = useRoutineData();
  const projects = useProjects();
  const items = useProjectItems();
  const [period, setPeriod] = useState<Period>('week');
  const [scope, setScope] = useState<string>(FAMILY);

  if (data.isLoading || projects.isPending || items.isPending) return <Loading />;

  const now = new Date();
  const from = period === 'week' ? weekStart(now) : monthStart(now);
  const prevFrom = period === 'week' ? subDays(from, 7) : monthStart(subMonths(now, 1));
  const prevTo = period === 'week' ? subDays(from, 1) : endOfMonth(prevFrom);

  const scoped =
    scope === FAMILY ? familyRoutines(data.routines, data.categoryById) : routinesFor(scope, data.routines, data.categoryById);
  const current = pct(scoreRoutines(scoped, data.logIndex, from, now, now));
  const previous = pct(scoreRoutines(scoped, data.logIndex, prevFrom, prevTo, now));
  const delta = current !== null && previous !== null ? current - previous : null;

  // Last 8 weeks trend.
  const trend = Array.from({ length: 8 }, (_, i) => {
    const start = subDays(weekStart(now), 7 * (7 - i));
    const end = addDays(start, 6);
    return { label: format(start, 'd/M'), value: pct(scoreRoutines(scoped, data.logIndex, start, isAfter(end, now) ? now : end, now)) };
  });

  // Score per category.
  const categories = data.categories
    .map((c) => {
      const rs = scoped.filter((r) => r.category_id === c.id);
      return { c, value: rs.length ? pct(scoreRoutines(rs, data.logIndex, from, now, now)) : undefined };
    })
    .filter((x) => x.value !== undefined);

  // Who did the family routines this period.
  const familyIds = new Set(familyRoutines(data.routines, data.categoryById).map((r) => r.id));
  const fromKey = format(from, 'yyyy-MM-dd');
  const contributions = new Map<string, number>();
  for (const log of data.logs) {
    if (familyIds.has(log.routine_id) && log.log_date >= fromKey && log.status !== 'skipped') {
      contributions.set(log.user_id, (contributions.get(log.user_id) ?? 0) + (log.status === 'done' ? 1 : 0.5));
    }
  }
  const totalContribution = [...contributions.values()].reduce((a, b) => a + b, 0);

  const streaks = scoped
    .map((r) => ({ r, s: streak(r, data.logIndex, now) }))
    .filter((x) => x.s >= 2)
    .sort((a, b) => b.s - a.s)
    .slice(0, 5);

  // Projects visible in this scope.
  const day = today();
  const scopedProjects = (projects.data ?? []).filter(
    (p) => p.status === 'active' && (scope === FAMILY ? p.visibility === 'family' : scope === userId || p.visibility === 'family'),
  );
  const projectSignals = scopedProjects.map((p) => ({ name: p.name, ...projectStats(p, items.data ?? [], day) }));
  const stepsDone = (items.data ?? []).filter(
    (i) => i.completed_at && i.completed_at >= from.toISOString() && scopedProjects.some((p) => p.id === i.project_id),
  ).length;

  const insights = buildInsights(scoped, data.logIndex, projectSignals, now);
  const isOther = scope !== FAMILY && scope !== userId;

  return (
    <>
      <Stack.Screen options={{ title: 'Scorecard' }} />
      <Screen onRefresh={data.refetch} refreshing={data.isRefetching}>
        <Segmented
          options={[
            { value: 'week', label: 'This week' },
            { value: 'month', label: 'This month' },
          ]}
          value={period}
          onChange={setPeriod}
        />
        <View style={styles.wrap}>
          <Chip label="👨‍👩‍👧 Family" selected={scope === FAMILY} onPress={() => setScope(FAMILY)} />
          {members.map((m) => (
            <Chip
              key={m.user_id}
              label={m.user_id === userId ? 'Me' : m.profile.display_name}
              selected={scope === m.user_id}
              onPress={() => setScope(m.user_id)}
            />
          ))}
        </View>

        <Card style={{ alignItems: 'center', paddingVertical: 24 }}>
          <ThemedText style={{ fontSize: 56, lineHeight: 64, fontWeight: 800, color: bandColor(band(current)) }}>
            {current === null ? '—' : `${current}%`}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {delta === null
              ? 'No routines scheduled yet'
              : `${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta)} pts vs last ${period}`}
          </ThemedText>
          {isOther && (
            <ThemedText type="small" themeColor="textSecondary">
              Based on shared routines assigned to {memberById.get(scope)?.profile.display_name}
            </ThemedText>
          )}
        </Card>

        <SectionTitle>Feedback</SectionTitle>
        {insights.map((i) => (
          <Card
            key={i.id}
            style={{
              borderLeftWidth: 4,
              borderLeftColor: i.tone === 'good' ? theme.success : i.tone === 'warn' ? theme.warning : theme.tint,
            }}>
            <ThemedText type="smallBold" style={{ fontSize: 16 }}>
              {i.icon} {i.title}
            </ThemedText>
            {i.body && (
              <ThemedText type="small" themeColor="textSecondary">
                {i.body}
              </ThemedText>
            )}
          </Card>
        ))}

        <SectionTitle>Last 8 weeks</SectionTitle>
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 120, gap: 6 }}>
            {trend.map((t, i) => (
              <View key={i} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 10 }}>
                  {t.value ?? ''}
                </ThemedText>
                <View
                  style={{
                    width: '70%',
                    height: `${Math.max(t.value ?? 0, 2) * 0.8}%`,
                    borderRadius: 4,
                    backgroundColor: t.value === null ? theme.backgroundSelected : bandColor(band(t.value)),
                  }}
                />
              </View>
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {trend.map((t, i) => (
              <ThemedText key={i} type="small" themeColor="textSecondary" style={{ flex: 1, textAlign: 'center', fontSize: 10 }}>
                {t.label}
              </ThemedText>
            ))}
          </View>
        </Card>

        {categories.length > 0 && (
          <>
            <SectionTitle>By category</SectionTitle>
            <Card>
              {categories.map(({ c, value }) => (
                <View key={c.id} style={{ gap: 4, paddingVertical: 4 }}>
                  <View style={[styles.row, { justifyContent: 'space-between' }]}>
                    <ThemedText>
                      {c.icon} {c.name}
                    </ThemedText>
                    <ScorePill value={value ?? null} />
                  </View>
                  {value != null && <ProgressBar value={value} />}
                </View>
              ))}
            </Card>
          </>
        )}

        {streaks.length > 0 && (
          <>
            <SectionTitle>Streaks</SectionTitle>
            <Card>
              {streaks.map(({ r, s }) => (
                <View key={r.id} style={[styles.row, { justifyContent: 'space-between' }]}>
                  <ThemedText>{r.name}</ThemedText>
                  <ThemedText type="smallBold">🔥 {s}</ThemedText>
                </View>
              ))}
            </Card>
          </>
        )}

        {scope === FAMILY && totalContribution > 0 && (
          <>
            <SectionTitle>Who kept the house running</SectionTitle>
            <Card>
              {members.map((m) => {
                const value = contributions.get(m.user_id) ?? 0;
                const share = Math.round((100 * value) / totalContribution);
                return (
                  <View key={m.user_id} style={{ gap: 4, paddingVertical: 4 }}>
                    <View style={[styles.row, { justifyContent: 'space-between' }]}>
                      <View style={[styles.row, { gap: 8 }]}>
                        <Avatar profile={m.profile} size={24} />
                        <ThemedText>{m.profile.display_name}</ThemedText>
                      </View>
                      <ThemedText type="small" themeColor="textSecondary">
                        {value} check-ins · {share}%
                      </ThemedText>
                    </View>
                    <ProgressBar value={share} color={memberColor(m.user_id)} />
                  </View>
                );
              })}
            </Card>
          </>
        )}

        {scopedProjects.length > 0 && (
          <>
            <SectionTitle>Projects</SectionTitle>
            <Card>
              <ThemedText type="small" themeColor="textSecondary">
                {stepsDone} step{stepsDone === 1 ? '' : 's'} completed this {period}
              </ThemedText>
              {projectSignals.map((p, i) => (
                <View key={i} style={{ gap: 4, paddingVertical: 4 }}>
                  <View style={[styles.row, { justifyContent: 'space-between' }]}>
                    <ThemedText>
                      {scopedProjects[i].icon} {p.name}
                    </ThemedText>
                    <ThemedText type="smallBold">{p.percent}%</ThemedText>
                  </View>
                  <ProgressBar value={p.percent} color={theme.tint} />
                </View>
              ))}
            </Card>
          </>
        )}
      </Screen>
    </>
  );
}
