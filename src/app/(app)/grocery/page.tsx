import { createClient } from '@/lib/supabase/server';
import { MasterFoodItem } from '@/types/database';
import { GroceryDays } from './grocery-days';

export default async function GroceryPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: membership } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('profile_id', user.id)
    .single();

  if (!membership) return <p>Join a household first</p>;

  // Fetch master food list for the user (active items with daily_quantity > 0)
  const { data: items } = await supabase
    .from('master_food_list')
    .select('*')
    .eq('profile_id', user.id)
    .eq('is_active', true)
    .gt('daily_quantity', 0)
    .order('category')
    .order('name');

  return (
    <GroceryDays
      items={(items as MasterFoodItem[]) || []}
      profileId={user.id}
      householdId={membership.household_id}
    />
  );
}
