create table food_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  name_local text,
  category text not null check (category in ('grain', 'dal', 'vegetable', 'fruit', 'dairy', 'meat', 'snack', 'beverage', 'condiment', 'oil', 'nut_seed', 'protein_supplement')),
  subcategory text,
  serving_size_g numeric(7,1) not null,
  serving_unit text not null default 'g',
  calories_per_serving numeric(7,1) not null,
  protein_g numeric(6,1) not null,
  carbs_g numeric(6,1) not null,
  fat_g numeric(6,1) not null,
  fiber_g numeric(6,1) default 0,
  sugar_g numeric(6,1) default 0,
  sodium_mg numeric(7,1) default 0,
  is_veg boolean default true,
  is_egg boolean default false,
  is_vegan boolean default false,
  preferred_brand text,
  source text default 'seed',
  created_by uuid references profiles(id),
  household_id uuid references households(id),
  created_at timestamptz default now(),
  search_vector tsvector generated always as (
    to_tsvector('english', coalesce(name, '') || ' ' || coalesce(name_local, '') || ' ' || coalesce(category, '') || ' ' || coalesce(subcategory, ''))
  ) stored
);

create index food_items_search_idx on food_items using gin(search_vector);
create index food_items_category_idx on food_items(category);
create index food_items_veg_idx on food_items(is_veg);

alter table food_items enable row level security;
create policy "Anyone can view seed food items" on food_items for select
  using (source = 'seed' or created_by = auth.uid() or household_id in (
    select household_id from household_members where profile_id = auth.uid()
  ));
create policy "Users can create food items" on food_items for insert
  with check (auth.uid() is not null);
create policy "Users can update own food items" on food_items for update
  using (created_by = auth.uid());
