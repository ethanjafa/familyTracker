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

const SLOTS: { slot: MealSlot; icon: string; label: string }[] = [
  { slot: 'lunch', icon: '🥪', label: 'Lunch' },
  { slot: 'dinner', icon: '🍽️', label: 'Dinner' },
];

/** Spinning is an event, not rendering, so the randomness lives outside the component. */
const pickRandom = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];

/** Meals: lunch and dinner for each day, filled from one shared meal backlog. */
export function MealPlanner({ days }: { days: Date[] }) {
  const theme = useTheme();
  const { household, memberById } = useHousehold();
  const meals = useMeals();
  const plans = useMealPlans();
  const [open, setOpen] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  if (meals.isPending || plans.isPending) return <Loading />;

  const mealById = new Map((meals.data ?? []).map((m) => [m.id, m]));
  const keys = days.map(toDay);
  const weekPlans = (plans.data ?? []).filter((p) => keys.includes(p.plan_date));
  const planAt = (day: string, slot: MealSlot) => weekPlans.find((p) => p.plan_date === day && p.slot === slot);
  const plannedThisWeek = new Set(weekPlans.map((p) => p.meal_id).filter(Boolean));
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

  const place = async (meal: Meal, day: string, slot: MealSlot) => {
    try {
      const added = await planMeal(meal, day, slot, planAt(day, slot)?.cook_id ?? null);
      setOpen(null);
      flash(
        `${meal.icon} ${meal.name} for ${format(fromDay(day), 'EEEE')} ${slot}` +
          (added ? ` · 🛒 ${added} ingredient${added === 1 ? '' : 's'} added to groceries` : ''),
      );
    } catch (e) {
      showAlert('Could not plan', errorMessage(e));
    }
  };

  // Spin fills the next free dinner, then the next free lunch, from today on.
  const today = startOfDay(new Date());
  const ahead = keys.filter((k) => !isBefore(fromDay(k), today));
  const spin = () => {
    if (!backlog.length) return showAlert('Nothing to spin', 'Add a few meals to the backlog first.');
    const free =
      ahead.map((k) => ({ day: k, slot: 'dinner' as const })).find((s) => !planAt(s.day, s.slot)?.meal_id) ??
      ahead.map((k) => ({ day: k, slot: 'lunch' as const })).find((s) => !planAt(s.day, s.slot)?.meal_id);
    if (!free) return showAlert('Week is full', 'Every lunch and dinner this week is already planned.');
    place(pickRandom(backlog), free.day, free.slot);
  };

  const addIdea = (idea: (typeof MEAL_IDEAS)[number]) =>
    saveMeal({ household_id: household.id, ...idea }).catch((e) => showAlert('Could not add', errorMessage(e)));
  const ideas = MEAL_IDEAS.filter((i) => !(meals.data ?? []).some((m) => m.name.toLowerCase() === i.name.toLowerCase()));

  return (
    <>
      <Card style={{ gap: 0, paddingVertical: 4 }}>
        {days.map((d, i) => {
          const key = keys[i];
          const past = isBefore(d, today);
          const openSlot = SLOTS.find((s) => open === `${s.slot}:${key}`);
          return (
            <View key={key} style={[local.day, i > 0 && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
              <View style={[styles.row, { alignItems: 'flex-start', gap: 12, opacity: past ? 0.55 : 1 }]}>
                <ThemedText type="smallBold" style={{ width: 34, paddingTop: 4 }} themeColor="textSecondary">
                  {format(d, 'EEE')}
                </ThemedText>
                <View style={{ flex: 1, gap: 2 }}>
                  {SLOTS.map((s) => {
                    const plan = planAt(key, s.slot);
                    const meal = plan?.meal_id ? mealById.get(plan.meal_id) : undefined;
                    const id = `${s.slot}:${key}`;
                    return (
                      <Pressable
                        key={s.slot}
                        onPress={() => setOpen(open === id ? null : id)}
                        style={({ pressed }) => [styles.row, local.slot, { opacity: pressed ? 0.6 : 1 }]}>
                        <ThemedText style={{ width: 22 }}>{meal?.icon ?? s.icon}</ThemedText>
                        {meal ? (
                          <ThemedText style={{ flex: 1, fontWeight: 600 }} numberOfLines={1}>
                            {meal.name}
                          </ThemedText>
                        ) : (
                          <ThemedText type="small" themeColor="tint" style={{ flex: 1, fontWeight: 700 }}>
                            ＋ {s.label}
                          </ThemedText>
                        )}
                        {plan?.cook_id && <Avatar profile={memberById.get(plan.cook_id)?.profile} size={22} />}
                      </Pressable>
                    );
                  })}
                </View>
              </View>
              {openSlot && (
                <SlotEditor
                  slot={openSlot}
                  plan={planAt(key, openSlot.slot)}
                  backlog={backlog}
                  onPick={(m) => place(m, key, openSlot.slot)}
                  onDone={() => setOpen(null)}
                />
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

      <SectionTitle right={<HeaderButton title="＋ New" onPress={() => router.push('/meal-form')} />}>📝 Meal backlog</SectionTitle>
      <Button title="🎡 Spin for a meal" variant="secondary" onPress={spin} />
      {backlog.length > 0 && (
        <Card style={{ gap: 0, paddingVertical: 4 }}>
          {backlog.map((m, i) => {
            const isOpen = open === `meal:${m.id}`;
            const last = lastHad.get(m.id);
            const weeks = last ? differenceInCalendarWeeks(days[0], fromDay(last), { weekStartsOn: 1 }) : null;
            return (
              <View key={m.id} style={[local.day, i > 0 && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
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
                  <Animated.View entering={FadeIn.duration(160)} style={{ gap: 8, paddingTop: 10 }}>
                    {SLOTS.map((s) => (
                      <View key={s.slot} style={{ gap: 6 }}>
                        <Label>
                          {s.icon} {s.label}
                        </Label>
                        <DayChips days={days} value={null} onChange={(d) => d && place(m, d, s.slot)} />
                      </View>
                    ))}
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

/** Under a day: pick its lunch or dinner from the backlog, or set the cook / send it back. */
function SlotEditor({
  slot,
  plan,
  backlog,
  onPick,
  onDone,
}: {
  slot: (typeof SLOTS)[number];
  plan: MealPlan | undefined;
  backlog: Meal[];
  onPick: (meal: Meal) => void;
  onDone: () => void;
}) {
  const fail = (e: unknown) => showAlert('Could not update', errorMessage(e));
  return (
    <Animated.View entering={FadeIn.duration(160)} style={{ gap: 8, paddingTop: 10 }}>
      {plan?.meal_id ? (
        <>
          <Label>Who&apos;s making {slot.label.toLowerCase()}</Label>
          <PersonChips value={plan.cook_id} onChange={(id) => setCook(plan, id).catch(fail)} noneLabel="Not decided" />
          <Pressable
            onPress={() => unplanMeal(plan.id).then(onDone, fail)}
            hitSlop={8}
            style={({ pressed }) => ({ alignSelf: 'flex-start', opacity: pressed ? 0.6 : 1 })}>
            <ThemedText type="small" themeColor="textSecondary" style={{ fontWeight: 700 }}>
              ✕ Back to the backlog
            </ThemedText>
          </Pressable>
        </>
      ) : backlog.length ? (
        <>
          <Label>
            Pick {slot.label.toLowerCase()} from the backlog
          </Label>
          {/* The whole backlog, one meal per line, so long names are never cut off. */}
          <View style={local.pickList}>
            {backlog.map((m) => (
              <Pressable
                key={m.id}
                onPress={() => onPick(m)}
                style={({ pressed }) => [styles.row, local.pick, { opacity: pressed ? 0.6 : 1 }]}>
                <IconTile icon={m.icon} size={32} />
                <ThemedText style={{ flex: 1, fontWeight: 600 }}>{m.name}</ThemedText>
                <ThemedText type="small" themeColor="tint" style={{ fontWeight: 700 }}>
                  Pick
                </ThemedText>
              </Pressable>
            ))}
          </View>
        </>
      ) : (
        <ThemedText type="small" themeColor="textSecondary">
          Add meals to the backlog below first.
        </ThemedText>
      )}
    </Animated.View>
  );
}

const local = StyleSheet.create({
  day: { paddingVertical: 10 },
  slot: { gap: 8, paddingVertical: 3 },
  note: { borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 10 },
  move: { borderRadius: Radius.pill, paddingHorizontal: 12, paddingVertical: 6 },
  pickList: { gap: 2 },
  pick: { gap: 10, paddingVertical: 6 },
});
