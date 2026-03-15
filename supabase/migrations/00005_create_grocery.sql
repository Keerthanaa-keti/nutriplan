create table grocery_lists (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households(id) on delete cascade,
  meal_plan_id uuid references meal_plans(id),
  name text not null default 'Weekly Groceries',
  shop_date date,
  status text check (status in ('draft', 'shopping', 'done')) default 'draft',
  total_estimated_cost numeric(10,2),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table grocery_items (
  id uuid primary key default gen_random_uuid(),
  grocery_list_id uuid references grocery_lists(id) on delete cascade,
  food_item_id uuid references food_items(id),
  name_override text,
  quantity numeric(7,1) not null,
  unit text not null default 'g',
  category text,
  is_checked boolean default false,
  created_at timestamptz default now()
);

create table grocery_prices (
  id uuid primary key default gen_random_uuid(),
  food_item_id uuid references food_items(id) on delete cascade,
  platform text not null check (platform in ('bigbasket', 'blinkit', 'zepto', 'swiggy_instamart', 'firstclub', 'dmart', 'manual')),
  price numeric(8,2) not null,
  pack_quantity numeric(7,1) not null,
  pack_unit text not null default 'g',
  brand text,
  product_name text,
  url text,
  last_verified_at timestamptz default now(),
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

create index grocery_prices_food_idx on grocery_prices(food_item_id);
create index grocery_prices_platform_idx on grocery_prices(platform);

alter table grocery_lists enable row level security;
alter table grocery_items enable row level security;
alter table grocery_prices enable row level security;

create policy "Members can manage grocery lists" on grocery_lists for all
  using (household_id in (select household_id from household_members where profile_id = auth.uid()));
create policy "Members can manage grocery items" on grocery_items for all
  using (grocery_list_id in (select id from grocery_lists where household_id in (
    select household_id from household_members where profile_id = auth.uid()
  )));
create policy "Anyone can view prices" on grocery_prices for select using (true);
create policy "Users can add prices" on grocery_prices for insert with check (auth.uid() is not null);
