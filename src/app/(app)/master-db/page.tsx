import { createClient } from '@/lib/supabase/server';
import { MasterTable } from './master-table';

export default async function MasterDatabasePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: membership } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('profile_id', user.id)
    .single();

  const { data: items } = await supabase
    .from('master_food_list')
    .select('*')
    .eq('profile_id', user.id)
    .eq('is_active', true)
    .order('category')
    .order('name');

  return (
    <MasterTable
      items={items || []}
      userId={user.id}
      householdId={membership?.household_id || ''}
    />
  );
}
