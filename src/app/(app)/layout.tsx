export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { SidebarNav } from '@/components/layout/sidebar';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (profile && !profile.onboarding_complete) redirect('/onboarding');

  return (
    <div className="flex h-screen bg-gray-50">
      <SidebarNav userName={profile?.full_name || user.email || ''} />
      <main className="flex-1 overflow-auto pt-[57px] pb-[60px] md:pt-0 md:pb-0">
        <div className="max-w-7xl mx-auto p-4 md:p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
