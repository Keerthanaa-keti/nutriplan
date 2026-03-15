create table meal_plans (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households(id) on delete cascade,
  week_start date not null,
  status text check (status in ('draft', 'active', 'completed')) default 'draft',
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(household_id, week_start)
);

create table meal_plan_items (
  id uuid primary key default gen_random_uuid(),
  meal_plan_id uuid references meal_plans(id) on delete cascade,
  profile_id uuid references profiles(id),
  day_of_week integer not null check (day_of_week between 0 and 6),
  meal_type text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack_am', 'snack_pm')),
  food_item_id uuid references food_items(id),
  servings numeric(4,1) default 1,
  custom_calories numeric(7,1),
  custom_protein_g numeric(6,1),
  custom_carbs_g numeric(6,1),
  custom_fat_g numeric(6,1),
  notes text,
  is_cheat boolean default false,
  created_at timestamptz default now()
);

create index meal_plan_items_plan_idx on meal_plan_items(meal_plan_id);
create index meal_plan_items_profile_idx on meal_plan_items(profile_id);
create index meal_plan_items_day_idx on meal_plan_items(meal_plan_id, day_of_week);

alter table meal_plans enable row level security;
alter table meal_plan_items enable row level security;

create policy "Members can view meal plans" on meal_plans for select
  using (household_id in (select household_id from household_members where profile_id = auth.uid()));
create policy "Members can create meal plans" on meal_plans for insert
  with check (household_id in (select household_id from household_members where profile_id = auth.uid()));
create policy "Members can update meal plans" on meal_plans for update
  using (household_id in (select household_id from household_members where profile_id = auth.uid()));
create policy "Members can delete meal plans" on meal_plans for delete
  using (household_id in (select household_id from household_members where profile_id = auth.uid()));

create policy "Members can view meal plan items" on meal_plan_items for select
  using (meal_plan_id in (select id from meal_plans where household_id in (
    select household_id from household_members where profile_id = auth.uid()
  )));
create policy "Members can manage meal plan items" on meal_plan_items for insert
  with check (meal_plan_id in (select id from meal_plans where household_id in (
    select household_id from household_members where profile_id = auth.uid()
  )));
create policy "Members can update meal plan items" on meal_plan_items for update
  using (meal_plan_id in (select id from meal_plans where household_id in (
    select household_id from household_members where profile_id = auth.uid()
  )));
create policy "Members can delete meal plan items" on meal_plan_items for delete
  using (meal_plan_id in (select id from meal_plans where household_id in (
    select household_id from household_members where profile_id = auth.uid()
  )));
