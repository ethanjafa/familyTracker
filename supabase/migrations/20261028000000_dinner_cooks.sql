-- A day's dinner can have a cook before the meal itself is chosen.
alter table public.meal_plans alter column meal_id drop not null;
