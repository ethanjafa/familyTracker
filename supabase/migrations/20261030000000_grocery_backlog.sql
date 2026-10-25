-- Groceries get a third list: the backlog (things you buy now and then, not needed right now).
alter table public.grocery_items drop constraint if exists grocery_items_status_check;
alter table public.grocery_items
  add constraint grocery_items_status_check check (status in ('have', 'need', 'backlog'));
