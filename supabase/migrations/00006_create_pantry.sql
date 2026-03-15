create table pantry_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households(id) on delete cascade,
  food_item_id uuid references food_items(id),
  name_override text,
  quantity_remaining numeric(7,1),
  unit text default 'g',
  purchased_date date,
  expiry_date date,
  shelf_life_days integer,
  status text check (status in ('available', 'low', 'finished')) default 'available',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table pantry_items enable row level security;
create policy "Members can manage pantry" on pantry_items for all
  using (household_id in (select household_id from household_members where profile_id = auth.uid()));
