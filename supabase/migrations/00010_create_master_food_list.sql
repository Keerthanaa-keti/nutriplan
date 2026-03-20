-- Master food list: per-user database of all food/grocery items they regularly consume
-- Each item has macros, cost, daily quantity, and computed cost columns

-- Category enum for master food items
create type food_category_enum as enum (
  'grain', 'dal', 'vegetable', 'fruit', 'dairy', 'meat', 'egg',
  'snack', 'beverage', 'condiment', 'oil', 'nut_seed',
  'protein_supplement', 'staple', 'spice'
);

-- Health category enum for restaurant items
create type health_category_enum as enum ('healthy', 'slight_cheat', 'cheat');

create table master_food_list (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) on delete cascade,
  household_id uuid references households(id) on delete cascade,

  -- Basic info
  name text not null,
  brand text,
  category food_category_enum not null default 'staple',

  -- Nutrition per serving
  serving_size_g numeric(8,1),
  serving_unit text default 'g',
  calories_per_serving numeric(8,1),
  protein_g numeric(6,1),
  carbs_g numeric(6,1),
  fat_g numeric(6,1),
  fiber_g numeric(6,1),

  -- Daily consumption
  daily_quantity numeric(6,2) default 1, -- servings per day

  -- Cost tracking
  cost_per_unit numeric(8,2), -- price of one pack
  pack_size numeric(8,1), -- how many servings in a pack
  pack_unit text default 'pack',

  -- Computed cost columns
  cost_per_serving numeric(8,2) generated always as (
    case when pack_size > 0 then round(cost_per_unit / pack_size, 2) else null end
  ) stored,
  cost_per_day numeric(8,2) generated always as (
    case when pack_size > 0 then round((cost_per_unit / pack_size) * daily_quantity, 2) else null end
  ) stored,
  cost_per_week numeric(8,2) generated always as (
    case when pack_size > 0 then round((cost_per_unit / pack_size) * daily_quantity * 7, 2) else null end
  ) stored,

  -- Source and platform
  preferred_platform text, -- bigbasket, blinkit, zepto, swiggy_instamart, dmart, manual
  source text default 'manual', -- manual, import_swiggy, import_bigbasket, import_blinkit, import_zepto, notion

  -- Meal and diet info
  typical_meal text[] default '{}', -- e.g. {'breakfast', 'lunch', 'snack_pm'}
  is_veg boolean default true,
  is_egg boolean default false,
  shelf_life_days integer,
  is_active boolean default true,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Indexes
create index master_food_list_profile_idx on master_food_list(profile_id);
create index master_food_list_household_idx on master_food_list(household_id);
create index master_food_list_category_idx on master_food_list(category);

-- RLS
alter table master_food_list enable row level security;
create policy "Allow all access to master_food_list" on master_food_list
  for all using (true) with check (true);

-- Add health_category to restaurant_items
alter table restaurant_items
  add column if not exists health_category health_category_enum;

-- Add template_id to meal_plans
alter table meal_plans
  add column if not exists template_id uuid;
