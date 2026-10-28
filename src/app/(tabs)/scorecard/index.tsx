import { addDays, format, isAfter, subDays } from 'date-fns';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { useProjectItems, useProjects } from '@/api/projects';
import { ThemedText } from '@/components/themed-text';
import { Avatar, Card, Chip, Loading, ProgressBar, Screen, ScorePill, SectionTitle, styles, useBandColor } from '@/components/ui';
import { useRoutineData } from '@/hooks/use-routine-data';
import { useTheme } from '@/hooks/use-theme';
import { fromDay, today, weekStart } from '@/lib/dates';
import { buildInsights } from '@/lib/insights';
import { categoryStats } from '@/lib/projects';
import { assigneesOn } from '@/lib/schedule';
import { band, familyRoutines, pct, routinesFor, scoreRoutines } from '@/lib/scoring';
import { useHousehold } from '@/providers/household-provider';

const FAMILY = 'family';

export default function ScorecardScreen() {
  const theme = useTheme();
  const bandColor = useBandColor();
  const { userId, members, memberById, memberColor } = useHousehold();
  const data = useRoutineData();
  const projects = useProjects();
  const items = useProjectItems();
  const period = 'week';
  const [scope, setScope] = useState<string>(FAMILY);
  const [explain, setExplain] = useState(false);

  if (data.isLoading || projects.isPending || items.isPending) return <Loading />;

  const now = new Date();
  const from = weekStart(now);
  const prevFrom = subDays(from, 7);
  const prevTo = subDays(from, 1);

  const scoped =
    scope === FAMILY ? familyRoutines(data.routines, data.categoryById) : routinesFor(scope, data.routines, data.categoryById);
  const score = scoreRoutines(scoped, data.logIndex, from, now, now);
  const current = pct(score);
  // In plain numbers: how many check-ins were due so far, and how many are done.
  const dueSoFar = Math.round(score.expected);
  const doneSoFar = Math.min(Math.round(score.achieved), dueSoFar);
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

  // Who did the family routines this period. A check-in counts for the routine's owner that day,
  // whoever ticked it off (e.g. one parent ticking the other's routine still counts for its owner).
  const familyById = new Map(familyRoutines(data.routines, data.categoryById).map((r) => [r.id, r]));
  const fromKey = format(from, 'yyyy-MM-dd');
  const contributions = new Map<string, number>();
  for (const log of data.logs) {
    const routine = familyById.get(log.routine_id);
    if (!routine || log.log_date < fromKey || log.status === 'skipped') continue;
    const owners = assigneesOn(routine, fromDay(log.log_date));
    // Unowned routines ("anyone") credit whoever did them.
    for (const owner of owners.length ? owners : [log.user_id]) {
      contributions.set(owner, (contributions.get(owner) ?? 0) + (log.status === 'done' ? 1 : 0.5));
    }
  }
  const totalContribution = [...contributions.values()].reduce((a, b) => a + b, 0);

  // To-do categories visible in this scope.
  const day = today();
  const scopedCategories = projects.data ?? [];
  const categorySignals = scopedCategories.map((p) => ({ name: p.name, icon: p.icon, ...categoryStats(p, items.data ?? [], day) }));
  const todosDone = (items.data ?? []).filter(
    (i) => i.completed_at && i.completed_at >= from.toISOString() && scopedCategories.some((p) => p.id === i.project_id),
  ).length;

  const insights = buildInsights(scoped, data.logIndex, categorySignals, now);
  const isOther = scope !== FAMILY && scope !== userId;
  const who = scope === FAMILY ? 'The family' : scope === userId ? 'You' : (memberById.get(scope)?.profile.display_name ?? 'They');

  return (
    <>
      <Stack.Screen options={{ title: 'Scorecard' }} />
      <Screen onRefresh={data.refetch} refreshing={data.isRefetching}>
        {totalContribution > 0 && (
          <>
            <SectionTitle>Who did the family routines this {period}</SectionTitle>
            <Card>
              {members.map((m) => {
                const value = contributions.get(m.user_id) ?? 0;
                const share = Math.round((100 * value) / totalContribution);
                return (
                  <View key={m.user_id} style={{ gap: 4, paddingVertical: 4 }}>
                    <View style={[styles.row, { justifyContent: 'space-between' }]}>
                      {/* Long names shorten with "…" so the numbers always fit on the card. */}
                      <View style={[styles.row, { gap: 8, flex: 1 }]}>
                        <Avatar profile={m.profile} size={24} />
                        <ThemedText numberOfLines={1} style={{ flex: 1 }}>
                          {m.profile.display_name}
                        </ThemedText>
                      </View>
                      <ThemedText type="small" themeColor="textSecondary" style={{ flexShrink: 0 }}>
                        {value} done · {share}% of all
                      </ThemedText>
                    </View>
                    <ProgressBar value={share} color={memberColor(m.user_id)} />
                  </View>
                );
              })}
            </Card>
          </>
        )}

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

        <Card style={{ alignItems: 'center', paddingVertical: 24, gap: 4 }}>
          {current === null ? (
            <ThemedText type="small" themeColor="textSecondary">
              Nothing was due yet this {period}.
            </ThemedText>
          ) : (
            <>
              <ThemedText style={{ fontSize: 44, lineHeight: 52, fontWeight: 800, color: bandColor(band(current)) }}>
                {doneSoFar} of {dueSoFar}
              </ThemedText>
              <ThemedText style={{ fontWeight: 600, textAlign: 'center' }}>
                routines done this {period} so far · {current}%
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
                {delta === null
                  ? `${who} had nothing due last ${period}.`
                  : delta === 0
                    ? `Same as last ${period}.`
                    : `${Math.abs(delta)}% ${delta > 0 ? 'better' : 'lower'} than last ${period} (${previous}%).`}
              </ThemedText>
            </>
          )}
          {isOther && (
            <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
              Counting the family routines {memberById.get(scope)?.profile.display_name} owns.
            </ThemedText>
          )}
          <Pressable onPress={() => setExplain((e) => !e)} hitSlop={8} style={{ marginTop: 6 }}>
            <ThemedText type="small" themeColor="tint" style={{ fontWeight: 700 }}>
              {explain ? 'Hide' : 'How is this counted?'}
            </ThemedText>
          </Pressable>
          {explain && (
            <View style={{ gap: 4, alignSelf: 'stretch', marginTop: 4 }}>
              {[
                'Every time a routine is due counts once: "Every day" is 7 a week, "Mon, Wed, Fri" is 3.',
                'Ticked off = done. Today only counts once you tick it, so an unfinished day never lowers it.',
                '"3× a week" routines count toward the days that have passed so far.',
                scope === FAMILY
                  ? 'Family counts all shared routines. Personal 🔒 routines are left out.'
                  : 'A person counts their personal routines plus the family routines they own.',
                'To-dos are shown separately below, not in this score.',
              ].map((line) => (
                <ThemedText key={line} type="small" themeColor="textSecondary">
                  • {line}
                </ThemedText>
              ))}
            </View>
          )}
        </Card>

        <SectionTitle>Last 8 weeks · % of routines done</SectionTitle>
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
            <SectionTitle>By category · % done this {period}</SectionTitle>
            <Card>
              {categories.map(({ c, value }) => (
                <View key={c.id} style={{ gap: 4, paddingVertical: 4 }}>
                  <View style={[styles.row, { justifyContent: 'space-between' }]}>
                    <ThemedText numberOfLines={1} style={{ flex: 1 }}>
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

        {scopedCategories.length > 0 && (
          <>
            <SectionTitle>To do</SectionTitle>
            <Card>
              <ThemedText type="small" themeColor="textSecondary">
                {todosDone} to-do{todosDone === 1 ? '' : 's'} done this {period}
              </ThemedText>
              {categorySignals.map((c, i) => (
                <View key={i} style={{ gap: 4, paddingVertical: 4 }}>
                  <View style={[styles.row, { justifyContent: 'space-between' }]}>
                    <ThemedText numberOfLines={1} style={{ flex: 1 }}>
                      {c.icon} {c.name}
                    </ThemedText>
                    <ThemedText type="smallBold">
                      {c.done}/{c.total}
                    </ThemedText>
                  </View>
                  <ProgressBar value={c.total ? (100 * c.done) / c.total : 0} color={theme.tint} />
                </View>
              ))}
            </Card>
          </>
        )}
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

      </Screen>
    </>
  );
}
