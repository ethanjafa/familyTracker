-- Where an item is usually bought (e.g. "Costco"). Optional; store mode groups the list by it.
alter table public.grocery_items add column if not exists store text;
