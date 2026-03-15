-- Restaurant food items with health analysis
create table restaurant_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households(id) on delete cascade,
  name text not null,
  restaurant_name text not null,
  platform text not null, -- swiggy, zomato

  -- Nutrition estimates
  estimated_calories integer,
  estimated_protein_g numeric(6,1),
  estimated_carbs_g numeric(6,1),
  estimated_fat_g numeric(6,1),

  -- Health scores (1-10)
  healthy_score integer check (healthy_score between 1 and 10),
  satiety_score integer check (satiety_score between 1 and 10),
  is_ultra_processed boolean default false,
  ultra_processed_reason text, -- e.g. "maida base, refined oil, excess sugar"

  -- Order stats
  times_ordered integer default 1,
  last_ordered_at timestamptz,
  total_spent numeric(10,2) default 0,
  avg_price numeric(8,2),
  is_veg boolean default true,

  -- For cheat meal recommendations
  is_favorite boolean default false,
  best_platform text, -- which platform has best price
  best_price numeric(8,2),

  -- Tags
  tags text[] default '{}', -- e.g. {'comfort', 'high-protein', 'quick'}

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index restaurant_items_household_idx on restaurant_items(household_id);
create index restaurant_items_name_idx on restaurant_items(name, restaurant_name);

alter table restaurant_items enable row level security;
create policy "Members can manage restaurant items" on restaurant_items for all
  using (household_id in (select household_id from household_members where profile_id = auth.uid()));

-- Add home_cook_ratio to households for the scale feature
alter table households add column if not exists home_cook_target integer default 80;
