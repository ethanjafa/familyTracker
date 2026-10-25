import type { Routine, RoutineCategory, Schedule, TimeOfDay, Visibility } from '@/lib/types';

/** A ready-made routine with sensible defaults; everything can be changed after adding it. */
export type RoutineTemplate = {
  name: string;
  schedule: Schedule;
  time_of_day: TimeOfDay;
  weight: 1 | 2 | 3;
};

export type CategoryTemplate = {
  key: string;
  name: string;
  icon: string;
  visibility: Visibility;
  /** Words that identify an existing category as this one (matched against its name). */
  keywords: string[];
  routines: RoutineTemplate[];
};

const daily: Schedule = { type: 'daily' };
const days = (...d: number[]): Schedule => ({ type: 'weekdays', days: d });
const weekdays = days(1, 2, 3, 4, 5);
const perWeek = (times: number): Schedule => ({ type: 'weekly', times });
const perTwoWeeks = (times: number): Schedule => ({ type: 'biweekly', times });

const r = (name: string, schedule: Schedule, time_of_day: TimeOfDay = 'anytime', weight: 1 | 2 | 3 = 2): RoutineTemplate => ({
  name,
  schedule,
  time_of_day,
  weight,
});

export const CATEGORY_TEMPLATES: CategoryTemplate[] = [
  // Family
  {
    key: 'house',
    name: 'House cleanliness',
    icon: '🧹',
    visibility: 'family',
    keywords: ['house', 'clean', 'home', 'chore', 'tidy'],
    routines: [
      r('Wash dishes', daily, 'evening', 3),
      r('Wipe kitchen counters', daily, 'evening'),
      r('Take out the trash', days(1, 4), 'evening'),
      r('Tidy up toys', daily, 'evening', 1),
      r('Vacuum living room', perWeek(2)),
      r('Clean bathrooms', perWeek(1)),
      r('Mop floors', perWeek(1), 'anytime', 1),
      r('Change bed sheets', perWeek(1), 'anytime', 1),
    ],
  },
  {
    key: 'laundry',
    name: 'Laundry',
    icon: '🧺',
    visibility: 'family',
    keywords: ['laundry', 'wash', 'clothes'],
    routines: [
      r('Run a load of laundry', perWeek(3)),
      r('Fold and put away clothes', perWeek(3)),
      r('Iron clothes', perWeek(1), 'anytime', 1),
    ],
  },
  {
    key: 'meals',
    name: 'Meals & groceries',
    icon: '🍽️',
    visibility: 'family',
    keywords: ['meal', 'food', 'cook', 'grocer', 'kitchen', 'dinner'],
    routines: [
      r('Cook dinner', daily, 'evening', 3),
      r('Empty the dishwasher', daily, 'morning'),
      r('Pack lunches', weekdays, 'morning'),
      r('Plan the week’s meals', perWeek(1)),
      r('Grocery shopping', perWeek(1)),
    ],
  },
  {
    key: 'kids',
    name: 'Kids',
    icon: '👨‍👩‍👧',
    visibility: 'family',
    keywords: ['kid', 'child', 'baby', 'school', 'daycare'],
    routines: [
      r('Drop off at school / daycare', weekdays, 'morning', 3),
      r('Pick up from school / daycare', weekdays, 'day', 3),
      r('Help with homework', weekdays, 'evening'),
      r('Bath time', daily, 'evening'),
      r('Bedtime story', daily, 'evening'),
      r('Pack school bag', weekdays, 'evening', 1),
    ],
  },
  {
    key: 'pets',
    name: 'Pets',
    icon: '🐶',
    visibility: 'family',
    keywords: ['pet', 'dog', 'cat', 'fish'],
    routines: [
      r('Feed the pets', daily, 'morning', 3),
      r('Walk the dog', daily, 'morning', 3),
      r('Evening walk', daily, 'evening'),
      r('Clean the litter box', perWeek(3)),
      r('Grooming / vet check', perTwoWeeks(1), 'anytime', 1),
    ],
  },
  {
    key: 'garden',
    name: 'Home & garden',
    icon: '🌿',
    visibility: 'family',
    keywords: ['garden', 'plant', 'yard', 'lawn', 'maintenance'],
    routines: [
      r('Water the plants', perWeek(2)),
      r('Mow the lawn', perWeek(1)),
      r('Check the mail', daily, 'day', 1),
      r('Take bins to the curb', days(3), 'evening'),
    ],
  },
  {
    key: 'money',
    name: 'Money',
    icon: '💰',
    visibility: 'family',
    keywords: ['money', 'finance', 'budget', 'bill', 'bank'],
    routines: [
      r('Review the budget', perWeek(1)),
      r('Pay the bills', perTwoWeeks(1), 'anytime', 3),
      r('Check bank accounts', perWeek(1), 'anytime', 1),
    ],
  },
  {
    key: 'together',
    name: 'Family time',
    icon: '❤️',
    visibility: 'family',
    keywords: ['family time', 'together', 'quality', 'date'],
    routines: [
      r('Family dinner together', daily, 'evening'),
      r('Weekly family meeting', perWeek(1)),
      r('Family outing', perWeek(1)),
      r('Date night', perTwoWeeks(1), 'evening'),
    ],
  },
  // Personal
  {
    key: 'health',
    name: 'Health',
    icon: '💪',
    visibility: 'personal',
    keywords: ['health', 'fitness', 'exercise', 'sport', 'gym', 'workout'],
    routines: [
      r('Exercise 30 min', perWeek(3), 'anytime', 3),
      r('Drink 8 glasses of water', daily),
      r('Take vitamins', daily, 'morning', 1),
      r('Walk 8,000 steps', daily),
      r('Stretch 10 min', daily, 'morning', 1),
    ],
  },
  {
    key: 'mind',
    name: 'Mind',
    icon: '🧘',
    visibility: 'personal',
    keywords: ['mind', 'mental', 'calm', 'meditat', 'wellbeing', 'well-being'],
    routines: [
      r('Meditate 10 min', daily, 'morning'),
      r('Journal', daily, 'evening'),
      r('Read 20 min', daily, 'evening'),
      r('No screens before bed', daily, 'evening', 1),
    ],
  },
  {
    key: 'sleep',
    name: 'Sleep',
    icon: '💤',
    visibility: 'personal',
    keywords: ['sleep', 'bed', 'rest'],
    routines: [r('In bed by 11 pm', daily, 'evening', 3), r('Wake up on time', daily, 'morning')],
  },
  {
    key: 'growth',
    name: 'Work & learning',
    icon: '📚',
    visibility: 'personal',
    keywords: ['work', 'learn', 'study', 'career', 'growth'],
    routines: [
      r('Plan tomorrow', weekdays, 'evening'),
      r('Learn something new 30 min', perWeek(3)),
      r('Inbox zero', weekdays, 'day', 1),
    ],
  },
  {
    key: 'self',
    name: 'Self-care',
    icon: '🙏',
    visibility: 'personal',
    keywords: ['self', 'care', 'relax', 'friends'],
    routines: [
      r('Skincare routine', daily, 'evening', 1),
      r('Call a friend or relative', perWeek(1)),
      r('Time for a hobby', perWeek(2)),
    ],
  },
];

const normalize = (s: string) => s.toLowerCase().trim();

/** The template an existing category most likely corresponds to (by icon or name keywords). */
export function templateFor(category: Pick<RoutineCategory, 'name' | 'icon'>): CategoryTemplate | undefined {
  const name = normalize(category.name);
  return (
    CATEGORY_TEMPLATES.find((t) => normalize(t.name) === name) ??
    CATEGORY_TEMPLATES.find((t) => t.keywords.some((k) => name.includes(k))) ??
    CATEGORY_TEMPLATES.find((t) => t.icon === category.icon)
  );
}

/** Routines from the matching template that the category doesn't have yet. */
export function suggestedRoutines(category: RoutineCategory, routines: Routine[]): RoutineTemplate[] {
  const template = templateFor(category);
  if (!template) return [];
  const have = new Set(routines.map((x) => normalize(x.name)));
  return template.routines.filter((t) => !have.has(normalize(t.name)));
}

/** Categories worth suggesting: templates none of the existing categories already cover. */
export function suggestedCategories(categories: RoutineCategory[]): CategoryTemplate[] {
  const covered = new Set(categories.map((c) => templateFor(c)?.key).filter(Boolean));
  return CATEGORY_TEMPLATES.filter((t) => !covered.has(t.key));
}

/** Suggestions for the routine-name field: matching templates first, then everything else that fits. */
export function routineIdeas(category: RoutineCategory | undefined, routines: Routine[], query: string): RoutineTemplate[] {
  const q = normalize(query);
  const have = new Set(routines.map((x) => normalize(x.name)));
  const own = category ? (templateFor(category)?.routines ?? []) : [];
  const rest = CATEGORY_TEMPLATES.flatMap((t) => t.routines);
  const seen = new Set<string>();
  return [...own, ...rest].filter((t) => {
    const key = normalize(t.name);
    if (seen.has(key) || have.has(key) || (q && !key.includes(q))) return false;
    seen.add(key);
    return true;
  });
}

export const getTemplate = (key: string) => CATEGORY_TEMPLATES.find((t) => t.key === key);
