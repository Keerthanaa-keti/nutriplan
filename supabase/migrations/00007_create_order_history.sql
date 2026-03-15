create table order_history (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households(id) on delete cascade,
  profile_id uuid references profiles(id),
  platform text not null,
  order_date timestamptz not null,
  order_type text check (order_type in ('food_delivery', 'grocery')) default 'food_delivery',
  items jsonb not null default '[]',
  total_amount numeric(10,2),
  raw_data jsonb,
  imported_at timestamptz default now()
);

create index order_history_household_idx on order_history(household_id);
create index order_history_date_idx on order_history(order_date);

alter table order_history enable row level security;
create policy "Members can view order history" on order_history for all
  using (household_id in (select household_id from household_members where profile_id = auth.uid()));
