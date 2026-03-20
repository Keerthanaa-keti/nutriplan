-- Weekly plan templates: predefined meal plan structures with protein themes

create table weekly_plan_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null, -- e.g. "Egg + Paneer Week"
  emoji text, -- e.g. "🥚+🧀"
  description text,
  protein_theme text, -- e.g. "egg_paneer", "egg_chicken", "egg_sprouts", "paneer_lentils"
  diet_type text, -- veg, egg, non_veg
  is_system boolean default false, -- true for built-in templates
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz default now()
);

create table template_meal_slots (
  id uuid primary key default gen_random_uuid(),
  template_id uuid references weekly_plan_templates(id) on delete cascade not null,
  meal_type text not null, -- breakfast, lunch, dinner, snack_am, snack_pm
  slot_type text not null default 'fixed', -- fixed or rotating
  slot_label text, -- e.g. "Base", "Daal", "Sabji", "Protein"
  food_item_id uuid references food_items(id) on delete set null, -- link to food_items table
  master_food_id uuid references master_food_list(id) on delete set null, -- link to master_food_list
  rotation_category text, -- e.g. "grain", "dal", "vegetable" — for rotating slots
  rotation_items jsonb, -- e.g. [{"name": "Rice", "food_item_id": "..."}, {"name": "Roti", "food_item_id": "..."}]
  servings numeric(6,2) default 1,
  sort_order integer default 0,
  created_at timestamptz default now()
);

-- Indexes
create index template_meal_slots_template_idx on template_meal_slots(template_id);

-- RLS
alter table weekly_plan_templates enable row level security;
create policy "Allow all access to weekly_plan_templates" on weekly_plan_templates
  for all using (true) with check (true);

alter table template_meal_slots enable row level security;
create policy "Allow all access to template_meal_slots" on template_meal_slots
  for all using (true) with check (true);

-- Add FK from meal_plans.template_id to weekly_plan_templates
alter table meal_plans
  add constraint meal_plans_template_id_fkey
  foreign key (template_id) references weekly_plan_templates(id) on delete set null;
