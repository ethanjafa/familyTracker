export type Visibility = 'personal' | 'family';

export type Profile = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  color: string;
};

export type Household = {
  id: string;
  name: string;
  /** Weekday the family plans the week (0 = Sunday … 6 = Saturday). Missing before the migration runs. */
  planning_day?: number;
  /** The "Plan the week together" routine that set_planning_day created. */
  planning_routine_id?: string | null;
};

export type Member = {
  user_id: string;
  role: 'owner' | 'adult';
  profile: Profile;
};

export type Schedule =
  | { type: 'daily' }
  | { type: 'weekdays'; days: number[] } // 0 = Sunday … 6 = Saturday
  | { type: 'weekly'; times: number }
  | { type: 'monthly'; times: number }
  | { type: 'interval'; every: number };

export type TimeOfDay = 'morning' | 'day' | 'evening' | 'anytime';

export type RoutineCategory = {
  id: string;
  household_id: string;
  owner_id: string;
  visibility: Visibility;
  name: string;
  icon: string;
  color: string;
  sort_order: number;
};

export type Routine = {
  id: string;
  category_id: string;
  household_id: string;
  name: string;
  schedule: Schedule;
  weight: number;
  time_of_day: TimeOfDay;
  assignee_ids: string[];
  /** Weekday ("0" = Sunday … "6" = Saturday) → user responsible that day. Empty = assignee_ids every day. */
  day_assignees?: Partial<Record<string, string>>;
  start_date: string;
  archived_at: string | null;
  /** This routine's plan changes, by day (yyyy-MM-dd). Attached client-side from routine_plans. */
  plans?: Map<string, RoutinePlan>;
  /** Set when narrowed to one person's share (their score, their Today list). */
  scoredFor?: string;
};

export type RoutinePlan = {
  id: string;
  routine_id: string;
  household_id: string;
  plan_date: string;
  planned: boolean;
  /** null = the routine's usual people. */
  assignee_id: string | null;
};

export type LogStatus = 'done' | 'partial' | 'skipped';

export type RoutineLog = {
  id: string;
  routine_id: string;
  household_id: string;
  user_id: string;
  log_date: string;
  status: LogStatus;
  note: string | null;
};

export type ProjectStatus = 'active' | 'on_hold' | 'done';

export type Project = {
  id: string;
  household_id: string;
  owner_id: string;
  visibility: Visibility;
  name: string;
  description: string | null;
  icon: string;
  color: string;
  status: ProjectStatus;
  target_date: string | null;
  budget: number | null;
  updated_at: string;
};

export type ItemStatus = 'todo' | 'in_progress' | 'blocked' | 'done';

export type ProjectItem = {
  id: string;
  project_id: string;
  household_id: string;
  title: string;
  notes: string | null;
  status: ItemStatus;
  assignee_id: string | null;
  due_date: string | null;
  planned_date?: string | null;
  cost: number | null;
  sort_order: number;
  completed_at: string | null;
  updated_at: string;
};

export type Meal = {
  id: string;
  household_id: string;
  name: string;
  icon: string;
  ingredients: string[];
};

export type MealSlot = 'lunch' | 'dinner';

export type MealPlan = {
  id: string;
  household_id: string;
  /** null = a cook is set but the meal isn't chosen yet. */
  meal_id: string | null;
  plan_date: string;
  slot: MealSlot;
  cook_id: string | null;
};

export type GroceryStatus = 'have' | 'need';

export type GroceryItem = {
  id: string;
  household_id: string;
  name: string;
  status: GroceryStatus;
  for_label: string | null;
  updated_at: string;
};
