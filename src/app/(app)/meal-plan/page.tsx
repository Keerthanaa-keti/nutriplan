import { createClient } from '@/lib/supabase/server';
import { Badge } from '@/components/ui/badge';
import { TemplatePicker } from './template-picker';
import { WeeklyPlanView } from './week-view';

export default async function MealPlanPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: membership } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('profile_id', user.id)
    .single();

  if (!membership) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Join a household first to create meal plans.</p>
      </div>
    );
  }

  // Get current week (Monday start)
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const weekStart = monday.toISOString().split('T')[0];

  // Check for existing meal plan this week
  const { data: plan } = await supabase
    .from('meal_plans')
    .select('*, weekly_plan_templates(id, name, emoji, protein_theme)')
    .eq('household_id', membership.household_id)
    .eq('week_start', weekStart)
    .single();

  // Get household members with profiles
  const { data: members } = await supabase
    .from('household_members')
    .select('profile_id, profiles:profiles(id, full_name, target_calories, target_protein_g, target_carbs_g, target_fat_g, diet_type)')
    .eq('household_id', membership.household_id);

  const profiles = (members || [])
    .map((m) => (m as unknown as {
      profiles: {
        id: string;
        full_name: string;
        target_calories: number;
        target_protein_g: number;
        target_carbs_g: number;
        target_fat_g: number;
        diet_type: string;
      }
    }).profiles)
    .filter(Boolean);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Meal Plan</h1>
          <p className="text-gray-500">
            Week of {new Date(weekStart).toLocaleDateString('en-IN', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
        </div>
        {plan && (
          <Badge variant={plan.status === 'active' ? 'default' : 'secondary'}>
            {plan.status}
          </Badge>
        )}
      </div>

      {!plan ? (
        <TemplatePickerLoader
          userId={user.id}
          weekStart={weekStart}
        />
      ) : (
        <WeekViewLoader
          planId={plan.id}
          planNotes={plan.notes}
          template={plan.weekly_plan_templates as unknown as { id: string; name: string; emoji: string; protein_theme: string } | null}
          profiles={profiles}
          weekStart={weekStart}
          householdId={membership.household_id}
        />
      )}
    </div>
  );
}

async function TemplatePickerLoader({
  userId,
  weekStart,
}: {
  userId: string;
  weekStart: string;
}) {
  const supabase = await createClient();

  // Fetch templates
  const { data: templates } = await supabase
    .from('weekly_plan_templates')
    .select('*')
    .eq('is_system', true)
    .order('name');

  // Fetch user's master food list for macro estimation
  const { data: masterItems } = await supabase
    .from('master_food_list')
    .select('id, name, category, calories_per_serving, protein_g, carbs_g, fat_g, daily_quantity, cost_per_day, cost_per_week')
    .eq('profile_id', userId)
    .eq('is_active', true);

  return (
    <TemplatePicker
      templates={templates || []}
      masterItems={masterItems || []}
      profileId={userId}
      weekStart={weekStart}
    />
  );
}

async function WeekViewLoader({
  planId,
  planNotes,
  template,
  profiles,
  weekStart,
  householdId,
}: {
  planId: string;
  planNotes: string | null;
  template: { id: string; name: string; emoji: string; protein_theme: string } | null;
  profiles: {
    id: string;
    full_name: string;
    target_calories: number;
    target_protein_g: number;
    target_carbs_g: number;
    target_fat_g: number;
  }[];
  weekStart: string;
  householdId: string;
}) {
  const supabase = await createClient();

  const { data } = await supabase
    .from('meal_plan_items')
    .select(`
      id, profile_id, day_of_week, meal_type, servings, notes, is_cheat,
      custom_calories, custom_protein_g, custom_carbs_g, custom_fat_g,
      food_item:food_items(id, name, calories_per_serving, protein_g, carbs_g, fat_g, serving_size_g, serving_unit, is_veg)
    `)
    .eq('meal_plan_id', planId)
    .order('day_of_week')
    .order('meal_type');

  const mealItems = (data || []) as unknown as {
    id: string;
    profile_id: string;
    day_of_week: number;
    meal_type: string;
    servings: number;
    notes: string | null;
    is_cheat: boolean;
    custom_calories: number | null;
    custom_protein_g: number | null;
    custom_carbs_g: number | null;
    custom_fat_g: number | null;
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
  }[];

  return (
    <WeeklyPlanView
      planId={planId}
      planNotes={planNotes}
      templateEmoji={template?.emoji || null}
      templateName={template?.name || null}
      profiles={profiles}
      mealItems={mealItems}
      weekStart={weekStart}
      householdId={householdId}
    />
  );
}
