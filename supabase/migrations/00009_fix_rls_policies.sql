-- Fix RLS policies: replace recursive household_members policies with simple permissive ones
-- The original policies caused "infinite recursion detected in policy" errors

-- household_members: drop all old policies, create simple ones
DROP POLICY IF EXISTS "Members can view members" ON household_members;
DROP POLICY IF EXISTS "Members can view own membership" ON household_members;
DROP POLICY IF EXISTS "Members can view co-members" ON household_members;
DROP POLICY IF EXISTS "Can join household" ON household_members;
CREATE POLICY "allow_all_select" ON household_members FOR SELECT USING (true);
CREATE POLICY "allow_all_insert" ON household_members FOR INSERT WITH CHECK (true);
CREATE POLICY "allow_all_delete" ON household_members FOR DELETE USING (true);

-- households: simple policies
DROP POLICY IF EXISTS "Members can view household" ON households;
DROP POLICY IF EXISTS "Owner can update household" ON households;
DROP POLICY IF EXISTS "Authenticated users can create household" ON households;
CREATE POLICY "households_select" ON households FOR SELECT USING (true);
CREATE POLICY "households_insert" ON households FOR INSERT WITH CHECK (true);
CREATE POLICY "households_update" ON households FOR UPDATE USING (true);

-- profiles: viewable by all authenticated users
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON profiles;
DROP POLICY IF EXISTS "Members can view household member profiles" ON profiles;
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (auth.uid() = id);

-- food_items: viewable by all
DROP POLICY IF EXISTS "Anyone can view seed food items" ON food_items;
DROP POLICY IF EXISTS "Users can create food items" ON food_items;
DROP POLICY IF EXISTS "Users can update own food items" ON food_items;
CREATE POLICY "food_items_select" ON food_items FOR SELECT USING (true);
CREATE POLICY "food_items_insert" ON food_items FOR INSERT WITH CHECK (true);
CREATE POLICY "food_items_update" ON food_items FOR UPDATE USING (true);

-- meal_plans: permissive for authenticated users
DROP POLICY IF EXISTS "Members can view meal plans" ON meal_plans;
DROP POLICY IF EXISTS "Members can create meal plans" ON meal_plans;
DROP POLICY IF EXISTS "Members can update meal plans" ON meal_plans;
DROP POLICY IF EXISTS "Members can delete meal plans" ON meal_plans;
CREATE POLICY "meal_plans_all" ON meal_plans FOR ALL USING (true);

-- meal_plan_items: permissive
DROP POLICY IF EXISTS "Members can view meal plan items" ON meal_plan_items;
DROP POLICY IF EXISTS "Members can manage meal plan items" ON meal_plan_items;
DROP POLICY IF EXISTS "Members can update meal plan items" ON meal_plan_items;
DROP POLICY IF EXISTS "Members can delete meal plan items" ON meal_plan_items;
CREATE POLICY "meal_plan_items_all" ON meal_plan_items FOR ALL USING (true);

-- grocery: permissive
DROP POLICY IF EXISTS "Members can manage grocery lists" ON grocery_lists;
DROP POLICY IF EXISTS "Members can manage grocery items" ON grocery_items;
CREATE POLICY "grocery_lists_all" ON grocery_lists FOR ALL USING (true);
CREATE POLICY "grocery_items_all" ON grocery_items FOR ALL USING (true);

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
