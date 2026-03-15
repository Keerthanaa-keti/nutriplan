create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  avatar_url text,
  date_of_birth date,
  gender text check (gender in ('male', 'female', 'other')),
  height_cm numeric(5,1),
  weight_kg numeric(5,1),
  activity_level text check (activity_level in ('sedentary', 'light', 'moderate', 'active', 'very_active')),
  diet_type text check (diet_type in ('veg', 'egg', 'non_veg', 'vegan')),
  allergies text[] default '{}',
  health_goal text check (health_goal in ('lose', 'maintain', 'gain', 'recomp')),
  target_calories integer,
  target_protein_g integer,
  target_carbs_g integer,
  target_fat_g integer,
  cheat_day_preference text default 'none',
  onboarding_complete boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), new.email);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

alter table profiles enable row level security;
create policy "Users can view own profile" on profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);
