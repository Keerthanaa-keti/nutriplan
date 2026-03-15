import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { CalendarDays, ShoppingCart, Target } from 'lucide-react';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  // Get profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  // Get household members
  const { data: membership } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('profile_id', user.id)
    .single();

  let householdMembers: { profile_id: string; role: string; profiles: { full_name: string; target_calories: number; target_protein_g: number; diet_type: string; weight_kg: number } }[] = [];
  let inviteCode = '';

  if (membership) {
    const { data: members } = await supabase
      .from('household_members')
      .select('profile_id, role, profiles:profiles(full_name, target_calories, target_protein_g, diet_type, weight_kg)')
      .eq('household_id', membership.household_id) as { data: typeof householdMembers | null };

    householdMembers = members || [];

    const { data: household } = await supabase
      .from('households')
      .select('invite_code')
      .eq('id', membership.household_id)
      .single();

    inviteCode = household?.invite_code || '';
  }

  // Get current week's meal plan
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const weekStart = monday.toISOString().split('T')[0];

  const { data: currentPlan } = await supabase
    .from('meal_plans')
    .select('id, status, week_start')
    .eq('household_id', membership?.household_id || '')
    .eq('week_start', weekStart)
    .single();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-gray-500">Welcome back, {profile?.full_name?.split(' ')[0]}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/meal-plan">
            <Button>
              <CalendarDays className="h-4 w-4 mr-2" />
              {currentPlan ? 'View Meal Plan' : 'Create Meal Plan'}
            </Button>
          </Link>
        </div>
      </div>

      {/* Household Members */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {householdMembers.map((member) => {
          const p = (member as unknown as { profiles: { full_name: string; target_calories: number; target_protein_g: number; diet_type: string; weight_kg: number } }).profiles;
          if (!p) return null;
          return (
            <Card key={member.profile_id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{p.full_name}</CardTitle>
                  <Badge variant={p.diet_type === 'veg' ? 'default' : p.diet_type === 'egg' ? 'secondary' : 'destructive'}>
                    {p.diet_type === 'veg' ? 'Veg' : p.diet_type === 'egg' ? 'Egg' : 'Non-Veg'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold">{p.target_calories || '-'}</p>
                    <p className="text-xs text-gray-500">kcal target</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{p.target_protein_g || '-'}g</p>
                    <p className="text-xs text-gray-500">protein</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{p.weight_kg || '-'}</p>
                    <p className="text-xs text-gray-500">kg</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Target className="h-5 w-5 text-green-700" />
              </div>
              <div>
                <p className="text-sm text-gray-500">This Week&apos;s Plan</p>
                <p className="font-medium">{currentPlan ? `${currentPlan.status}` : 'No plan yet'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <ShoppingCart className="h-5 w-5 text-orange-700" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Grocery Status</p>
                <p className="font-medium">Plan to generate list</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <CalendarDays className="h-5 w-5 text-blue-700" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Invite Partner</p>
                <p className="font-mono text-sm font-medium">{inviteCode || 'N/A'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Today's plan summary - placeholder for when meal plan exists */}
      {currentPlan && (
        <Card>
          <CardHeader>
            <CardTitle>Today&apos;s Meals</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-500 text-sm">Your meal plan is {currentPlan.status}. View the full plan to see today&apos;s meals.</p>
            <Link href="/meal-plan">
              <Button variant="outline" className="mt-3">View Full Plan</Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
