import { differenceInCalendarWeeks, format, isBefore, startOfDay } from 'date-fns';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { planMeal, saveMeal, setCook, unplanMeal, useMealPlans, useMeals } from '@/api/meals';
import { DayChips, PersonChips } from '@/components/plan/pickers';
import { ThemedText } from '@/components/themed-text';
import { Avatar, Button, Card, Chip, HeaderButton, IconTile, Label, Loading, SectionTitle, styles } from '@/components/ui';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { fromDay, toDay } from '@/lib/dates';
import { showAlert } from '@/lib/dialogs';
import { errorMessage } from '@/lib/errors';
import { MEAL_IDEAS } from '@/lib/meal-ideas';
import type { Meal, MealPlan, MealSlot } from '@/lib/types';
import { useHousehold } from '@/providers/household-provider';

/** Spinning is an event, not rendering, so the randomness lives outside the component. */
const pickRandom = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];

/** Meals: a lunch or dinner per day, filled from the meal backlog. */
export function MealPlanner({ days, slot }: { days: Date[]; slot: MealSlot }) {
  const label = slot === 'lunch' ? 'lunch' : 'dinner';
  const theme = useTheme();
  const { household, memberById } = useHousehold();
  const meals = useMeals();
  const plans = useMealPlans();
  const [open, setOpen] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  if (meals.isPending || plans.isPending) return <Loading />;

  const mealById = new Map((meals.data ?? []).map((m) => [m.id, m]));
  const keys = days.map(toDay);
  const planByDay = new Map(
    (plans.data ?? []).filter((p) => p.slot === slot && keys.includes(p.plan_date)).map((p) => [p.plan_date, p]),
  );
  const plannedThisWeek = new Set([...planByDay.values()].map((p) => p.meal_id).filter(Boolean));
  const lastHad = new Map<string, string>();
  for (const p of plans.data ?? []) {
    if (p.meal_id && p.plan_date < keys[0] && (lastHad.get(p.meal_id) ?? '') < p.plan_date) lastHad.set(p.meal_id, p.plan_date);
  }
  // Longest since you last had it first, so meals don't repeat.
  const backlog = [...(meals.data ?? [])]
    .filter((m) => !plannedThisWeek.has(m.id))
    .sort((a, b) => (lastHad.get(a.id) ?? '').localeCompare(lastHad.get(b.id) ?? ''));

  const flash = (message: string) => {
    setNote(message);
    setTimeout(() => setNote((n) => (n === message ? null : n)), 3500);
  };

  const place = async (meal: Meal, day: string) => {
    try {
      const added = await planMeal(meal, day, slot, planByDay.get(day)?.cook_id ?? null);
      setOpen(null);
      flash(
        `${meal.icon} ${meal.name} for ${format(fromDay(day), 'EEEE')} ${label}` +
          (added ? ` · 🛒 ${added} ingredient${added === 1 ? '' : 's'} added to groceries` : ''),
      );
    } catch (e) {
      showAlert('Could not plan', errorMessage(e));
    }
  };

  const today = startOfDay(new Date());
  const emptyDays = keys.filter((k) => !planByDay.has(k) && !isBefore(fromDay(k), today));
  const spin = () => {
    if (!backlog.length) return showAlert('Nothing to spin', 'Add a few meals to the backlog first.');
    if (!emptyDays.length) return showAlert('Week is full', `Every ${label} this week is already planned.`);
    place(pickRandom(backlog), emptyDays[0]);
  };

  const addIdea = (idea: (typeof MEAL_IDEAS)[number]) =>
    saveMeal({ household_id: household.id, ...idea }).catch((e) => showAlert('Could not add', errorMessage(e)));
  const ideas = MEAL_IDEAS.filter((i) => !(meals.data ?? []).some((m) => m.name.toLowerCase() === i.name.toLowerCase()));

  return (
    <>
      <SectionTitle>{slot === 'lunch' ? '🥪 Lunches' : '🍽️ Dinners'}</SectionTitle>
      <Card style={{ gap: 0, paddingVertical: 4 }}>
        {days.map((d, i) => {
          const key = keys[i];
          const plan = planByDay.get(key);
          const meal = plan?.meal_id ? mealById.get(plan.meal_id) : undefined;
          const isOpen = open === `day:${key}`;
          const past = isBefore(d, today);
          return (
            <View key={key} style={[local.slot, i > 0 && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
              <Pressable
                onPress={() => setOpen(isOpen ? null : `day:${key}`)}
                style={({ pressed }) => [styles.row, { gap: 12, opacity: pressed ? 0.6 : past ? 0.55 : 1 }]}>
                <ThemedText type="smallBold" style={{ width: 34 }} themeColor="textSecondary">
                  {format(d, 'EEE')}
                </ThemedText>
                {meal ? (
                  <>
                    <ThemedText style={{ fontSize: 22, lineHeight: 28 }}>{meal.icon}</ThemedText>
                    <ThemedText style={{ flex: 1, fontWeight: 600 }} numberOfLines={1}>
                      {meal.name}
                    </ThemedText>
                  </>
                ) : (
                  <ThemedText type="small" themeColor="tint" style={{ flex: 1, fontWeight: 700 }}>
                    ＋ Add {label}
                  </ThemedText>
                )}
                {plan?.cook_id && <Avatar profile={memberById.get(plan.cook_id)?.profile} size={24} />}
              </Pressable>
              {isOpen && (
                <Animated.View entering={FadeIn.duration(160)} style={{ gap: 8, paddingTop: 10 }}>
                  {plan && meal ? (
                    <PlannedMealEditor plan={plan} onRemove={() => setOpen(null)} />
                  ) : backlog.length ? (
                    <>
                      <Label>Pick from the backlog</Label>
                      <View style={styles.wrap}>
                        {backlog.slice(0, 8).map((m) => (
                          <Chip key={m.id} label={`${m.icon} ${m.name}`} selected={false} onPress={() => place(m, key)} />
                        ))}
                      </View>
                    </>
                  ) : (
                    <ThemedText type="small" themeColor="textSecondary">
                      Add meals to the backlog below first.
                    </ThemedText>
                  )}
                </Animated.View>
              )}
            </View>
          );
        })}
      </Card>

      {note && (
        <Animated.View entering={FadeIn} exiting={FadeOut} style={[local.note, { backgroundColor: theme.tintSoft }]}>
          <ThemedText type="small" themeColor="tint" style={{ fontWeight: 700 }}>
            {note}
          </ThemedText>
        </Animated.View>
      )}

      <SectionTitle right={<HeaderButton title="＋ New" onPress={() => router.push('/meal-form')} />}>
        📝 Meal backlog
      </SectionTitle>
      <Button title={`🎡 Spin for ${label}`} variant="secondary" onPress={spin} />
      {backlog.length > 0 && (
        <Card style={{ gap: 0, paddingVertical: 4 }}>
          {backlog.map((m, i) => {
            const isOpen = open === `meal:${m.id}`;
            const last = lastHad.get(m.id);
            const weeks = last ? differenceInCalendarWeeks(days[0], fromDay(last), { weekStartsOn: 1 }) : null;
            return (
              <View key={m.id} style={[local.slot, i > 0 && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
                <View style={[styles.row, { gap: 12 }]}>
                  <Pressable
                    onPress={() => router.push({ pathname: '/meal-form', params: { id: m.id } })}
                    style={({ pressed }) => [styles.row, { flex: 1, gap: 12, opacity: pressed ? 0.6 : 1 }]}>
                    <IconTile icon={m.icon} size={36} />
                    <View style={{ flex: 1 }}>
                      <ThemedText style={{ fontWeight: 600 }}>{m.name}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {weeks === null ? 'Never planned' : weeks <= 1 ? 'Had last week' : `Last had ${weeks} weeks ago`}
                        {m.ingredients.length ? ` · ${m.ingredients.length} ingredients` : ''}
                      </ThemedText>
                    </View>
                  </Pressable>
                  <Pressable
                    onPress={() => setOpen(isOpen ? null : `meal:${m.id}`)}
                    hitSlop={8}
                    style={({ pressed }) => [local.move, { backgroundColor: theme.tintSoft, opacity: pressed ? 0.6 : 1 }]}>
                    <ThemedText type="small" themeColor="tint" style={{ fontWeight: 700 }}>
                      → Day
                    </ThemedText>
                  </Pressable>
                </View>
                {isOpen && (
                  <Animated.View entering={FadeIn.duration(160)} style={{ paddingTop: 10 }}>
                    <DayChips days={days} value={null} onChange={(d) => d && place(m, d)} />
                  </Animated.View>
                )}
              </View>
            );
          })}
        </Card>
      )}
      {ideas.length > 0 && (
        <View style={{ gap: 8 }}>
          <ThemedText type="small" themeColor="textSecondary" style={{ fontWeight: 600 }}>
            💡 Ideas · tap to add to the backlog
          </ThemedText>
          <View style={styles.wrap}>
            {ideas.slice(0, 6).map((idea) => (
              <Chip key={idea.name} label={`${idea.icon} ${idea.name}`} selected={false} onPress={() => addIdea(idea)} />
            ))}
          </View>
        </View>
      )}
    </>
  );
}

function PlannedMealEditor({ plan, onRemove }: { plan: MealPlan; onRemove: () => void }) {
  const fail = (e: unknown) => showAlert('Could not update', errorMessage(e));
  return (
    <>
      <Label>Who&apos;s cooking</Label>
      <PersonChips value={plan.cook_id} onChange={(id) => setCook(plan, id).catch(fail)} noneLabel="Not decided" />
      <Pressable
        onPress={() => unplanMeal(plan.id).then(onRemove, fail)}
        hitSlop={8}
        style={({ pressed }) => ({ alignSelf: 'flex-start', opacity: pressed ? 0.6 : 1 })}>
        <ThemedText type="small" themeColor="textSecondary" style={{ fontWeight: 700 }}>
          ✕ Back to the backlog
        </ThemedText>
      </Pressable>
    </>
  );
}

const local = StyleSheet.create({
  slot: { paddingVertical: 10 },
  note: { borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 10 },
  move: { borderRadius: Radius.pill, paddingHorizontal: 12, paddingVertical: 6 },
});
