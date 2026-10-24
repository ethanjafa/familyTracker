-- Lunch as well as dinner: one meal per day per slot.
alter table public.meal_plans
  add column if not exists slot text not null default 'dinner' check (slot in ('lunch', 'dinner'));

alter table public.meal_plans drop constraint if exists meal_plans_household_id_plan_date_key;
alter table public.meal_plans add constraint meal_plans_household_day_slot unique (household_id, plan_date, slot);
