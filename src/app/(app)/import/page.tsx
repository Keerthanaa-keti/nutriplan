import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Download, Chrome, Smartphone, Mail } from 'lucide-react';

export default async function ImportPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: membership } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('profile_id', user.id)
    .single();

  let members: { profile_id: string; profile: { full_name: string; diet_type: string } }[] = [];
  let importCounts: Record<string, number> = {};

  if (membership) {
    const { data } = await supabase
      .from('household_members')
      .select('profile_id, profile:profiles(full_name, diet_type)')
      .eq('household_id', membership.household_id);
    members = (data || []) as unknown as typeof members;

    // Get import counts per member
    for (const m of members) {
      const { count } = await supabase
        .from('order_history')
        .select('*', { count: 'exact', head: true })
        .eq('profile_id', m.profile_id);
      importCounts[m.profile_id] = count || 0;
    }
  }

  const platforms = [
    { name: 'Swiggy', type: 'Food & Instamart', color: '#fc8019', icon: 'S' },
    { name: 'Zomato', type: 'Food Delivery', color: '#e23744', icon: 'Z' },
    { name: 'BigBasket', type: 'Groceries', color: '#84c225', icon: 'B' },
    { name: 'Blinkit', type: 'Groceries', color: '#f8cb46', icon: 'B' },
    { name: 'Zepto', type: 'Groceries', color: '#7b2d8e', icon: 'Z' },
    { name: 'FirstClub', type: 'Bulk Groceries', color: '#1a73e8', icon: 'F' },
  ];

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Import Your Data</h1>
        <p className="text-gray-500">Each family member imports their own app data. We analyze patterns individually and plan together.</p>
      </div>

      {/* How it works */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-4">
          <h3 className="font-medium text-blue-900 mb-2">How it works</h3>
          <div className="grid grid-cols-3 gap-4 text-center text-xs text-blue-800">
            <div>
              <Chrome className="h-6 w-6 mx-auto mb-1 text-blue-600" />
              <p className="font-medium">1. Install Extension</p>
              <p className="text-blue-600">Chrome extension reads your order history</p>
            </div>
            <div>
              <Download className="h-6 w-6 mx-auto mb-1 text-blue-600" />
              <p className="font-medium">2. Import Orders</p>
              <p className="text-blue-600">Click import for each app you use</p>
            </div>
            <div>
              <Smartphone className="h-6 w-6 mx-auto mb-1 text-blue-600" />
              <p className="font-medium">3. Get Insights</p>
              <p className="text-blue-600">We analyze your food & grocery patterns</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Per-member import status */}
      {members.map((member) => (
        <Card key={member.profile_id}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{member.profile?.full_name}</CardTitle>
              <Badge variant="outline">
                {importCounts[member.profile_id] || 0} orders imported
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {platforms.map((p) => (
                <div key={p.name} className="flex items-center gap-2 p-2 border rounded-lg text-sm">
                  <div className="w-7 h-7 rounded flex items-center justify-center text-white text-xs font-bold" style={{ background: p.color }}>
                    {p.icon}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-xs">{p.name}</p>
                    <p className="text-[10px] text-gray-400">{p.type}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-3">
              Use the NutriPlan Chrome extension to import. Each person should log into their own accounts.
            </p>
          </CardContent>
        </Card>
      ))}

      <Separator />

      {/* Two user types explanation */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-4">
            <h3 className="font-medium text-sm mb-2">Separate Accounts</h3>
            <p className="text-xs text-gray-500">Each person has their own Swiggy/BigBasket accounts. Import separately and we aggregate your family patterns.</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <h3 className="font-medium text-sm mb-2">Shared Accounts</h3>
            <p className="text-xs text-gray-500">Using one account together? Import once and we use AI to detect individual patterns. You confirm what belongs to whom.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
