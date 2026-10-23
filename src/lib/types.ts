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
  start_date: string;
  archived_at: string | null;
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
  cost: number | null;
  sort_order: number;
  completed_at: string | null;
  updated_at: string;
};
