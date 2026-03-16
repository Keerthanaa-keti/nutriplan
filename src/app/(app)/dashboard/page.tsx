import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';
import { CalendarDays, ShoppingCart, Target, Users, Utensils, ChefHat, Import, TrendingUp } from 'lucide-react';
import { HomeCookScale } from '@/components/family/home-cook-scale';
import { FamilyOverview } from '@/components/family/family-overview';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();

  const { data: membership } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('profile_id', user.id)
    .single();

  let members: { profile_id: string; role: string; profile: { id: string; full_name: string; target_calories: number; target_protein_g: number; target_carbs_g: number; target_fat_g: number; diet_type: string; weight_kg: number } }[] = [];
  let inviteCode = '';
  let householdName = '';

  if (membership) {
    // Fetch members and profiles separately to avoid RLS join issues
    const { data: rawMembers } = await supabase
      .from('household_members')
      .select('profile_id, role')
      .eq('household_id', membership.household_id);

    if (rawMembers && rawMembers.length > 0) {
      const profileIds = rawMembers.map(m => m.profile_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, target_calories, target_protein_g, target_carbs_g, target_fat_g, diet_type, weight_kg')
        .in('id', profileIds);

      members = rawMembers.map(m => ({
        profile_id: m.profile_id,
        role: m.role,
        profile: (profiles || []).find(p => p.id === m.profile_id) as typeof members[0]['profile'],
      })).filter(m => m.profile);
    }

    const { data: household } = await supabase
      .from('households')
      .select('invite_code, name')
      .eq('id', membership.household_id)
      .single();

    inviteCode = household?.invite_code || '';
    householdName = household?.name || 'Our Home';
  }

  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const weekStart = monday.toISOString().split('T')[0];

  const { data: currentPlan } = await supabase
    .from('meal_plans')
    .select('id, status')
    .eq('household_id', membership?.household_id || '')
    .eq('week_start', weekStart)
    .single();

  return (
    <div className="space-y-6">
      {/* Family Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6" />
            {householdName}
          </h1>
          <p className="text-gray-500">
            {members.length} member{members.length !== 1 ? 's' : ''} · Week of {new Date(weekStart).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/import">
            <Button variant="outline" size="sm">
              <Import className="h-4 w-4 mr-1" />
              Import Data
            </Button>
          </Link>
          <Link href="/meal-plan">
            <Button size="sm">
              <CalendarDays className="h-4 w-4 mr-1" />
              {currentPlan ? 'Meal Plan' : 'Create Plan'}
            </Button>
          </Link>
        </div>
      </div>

      {/* Family Members Overview */}
      <FamilyOverview members={members} inviteCode={inviteCode} />

      {/* Home Cook Scale */}
      <HomeCookScale />

      {/* Quick Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Link href="/meal-plan">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg"><CalendarDays className="h-5 w-5 text-green-700" /></div>
                <div>
                  <p className="text-sm text-gray-500">This Week</p>
                  <p className="font-medium">{currentPlan ? currentPlan.status : 'No plan'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/grocery">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg"><ShoppingCart className="h-5 w-5 text-orange-700" /></div>
                <div>
                  <p className="text-sm text-gray-500">Grocery</p>
                  <p className="font-medium">View List</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/restaurants">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg"><Utensils className="h-5 w-5 text-red-700" /></div>
                <div>
                  <p className="text-sm text-gray-500">Restaurants</p>
                  <p className="font-medium">Food Analysis</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/cheat-meals">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg"><ChefHat className="h-5 w-5 text-purple-700" /></div>
                <div>
                  <p className="text-sm text-gray-500">Cheat Day</p>
                  <p className="font-medium">Smart Treats</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
