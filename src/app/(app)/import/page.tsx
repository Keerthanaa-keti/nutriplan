import { createClient } from '@/lib/supabase/server';
import ImportClient from './import-client';

export default async function ImportPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single();

  const { data: membership } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('profile_id', user.id)
    .single();

  let importCounts: Record<string, number> = {};
  if (membership) {
    const { data: orders } = await supabase
      .from('order_history')
      .select('platform')
      .eq('profile_id', user.id);

    if (orders) {
      for (const o of orders) {
        importCounts[o.platform] = (importCounts[o.platform] || 0) + 1;
      }
    }
  }

  return (
    <ImportClient
      userName={profile?.full_name || 'User'}
      importCounts={importCounts}
      totalOrders={Object.values(importCounts).reduce((a, b) => a + b, 0)}
    />
  );
}
