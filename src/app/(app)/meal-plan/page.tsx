import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { DAYS_OF_WEEK, MEAL_TYPES } from '@/lib/nutrition/constants';
import { MealPlanWeekView } from '@/components/meal-plan/week-view';

export default async function MealPlanPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: membership } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('profile_id', user.id)
    .single();

  if (!membership) return <p>Join a household first</p>;

  // Get current week
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const weekStart = monday.toISOString().split('T')[0];

  // Get or show create option
  const { data: plan } = await supabase
    .from('meal_plans')
    .select('*')
    .eq('household_id', membership.household_id)
    .eq('week_start', weekStart)
    .single();

  // Get household members
  const { data: members } = await supabase
    .from('household_members')
    .select('profile_id, profiles:profiles(id, full_name, target_calories, target_protein_g, target_carbs_g, target_fat_g, diet_type)')
    .eq('household_id', membership.household_id);

  // Get meal plan items if plan exists
  let mealItems: {
    id: string;
    profile_id: string;
    day_of_week: number;
    meal_type: string;
    servings: number;
    notes: string | null;
    is_cheat: boolean;
    food_item: {
      id: string;
      name: string;
      calories_per_serving: number;
      protein_g: number;
      carbs_g: number;
      fat_g: number;
      serving_size_g: number;
      serving_unit: string;
      is_veg: boolean;
    } | null;
  }[] = [];

  if (plan) {
    const { data } = await supabase
      .from('meal_plan_items')
      .select('id, profile_id, day_of_week, meal_type, servings, notes, is_cheat, food_item:food_items(id, name, calories_per_serving, protein_g, carbs_g, fat_g, serving_size_g, serving_unit, is_veg)')
      .eq('meal_plan_id', plan.id)
      .order('day_of_week')
      .order('meal_type');

    mealItems = (data || []) as unknown as typeof mealItems;
  }

  const profiles = (members || []).map((m) => (m as unknown as { profiles: { id: string; full_name: string; target_calories: number; target_protein_g: number; target_carbs_g: number; target_fat_g: number; diet_type: string } }).profiles).filter(Boolean);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Meal Plan</h1>
          <p className="text-gray-500">
            Week of {new Date(weekStart).toLocaleDateString('en-IN', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
        {plan && (
          <Badge variant={plan.status === 'active' ? 'default' : 'secondary'}>
            {plan.status}
          </Badge>
        )}
      </div>

      {!plan ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500 mb-4">No meal plan for this week yet.</p>
            <MealPlanCreateButton householdId={membership.household_id} weekStart={weekStart} />
          </CardContent>
        </Card>
      ) : (
        <MealPlanWeekView
          planId={plan.id}
          profiles={profiles}
          mealItems={mealItems}
          householdId={membership.household_id}
        />
      )}
    </div>
  );
}

function MealPlanCreateButton({ householdId, weekStart }: { householdId: string; weekStart: string }) {
  return (
    <form action={async () => {
      'use server';
      const supabase = await (await import('@/lib/supabase/server')).createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.from('meal_plans').insert({
        household_id: householdId,
        week_start: weekStart,
        status: 'draft',
        created_by: user.id,
      });

      const { redirect } = await import('next/navigation');
      redirect('/meal-plan');
    }}>
      <Button type="submit">
        <Plus className="h-4 w-4 mr-2" />
        Create This Week&apos;s Plan
      </Button>
    </form>
  );
}
