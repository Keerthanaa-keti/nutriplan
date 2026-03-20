'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { DAYS_OF_WEEK } from '@/lib/nutrition/constants';
import { ShoppingCart, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

interface MealItem {
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
}

interface Profile {
  id: string;
  full_name: string;
  target_calories: number;
  target_protein_g: number;
  target_carbs_g: number;
  target_fat_g: number;
}

interface Props {
  planId: string;
  planNotes: string | null;
  templateEmoji: string | null;
  templateName: string | null;
  profiles: Profile[];
  mealItems: MealItem[];
  weekStart: string;
  householdId: string;
}

const MEAL_ORDER = ['breakfast', 'lunch', 'dinner', 'snack_pm'] as const;
const MEAL_LABELS: Record<string, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack_am: 'AM Snack',
  snack_pm: 'Snacks',
};

// Items whose notes indicate rotation get highlighted
function isRotatingItem(notes: string | null): boolean {
  if (!notes) return false;
  const lower = notes.toLowerCase();
  return lower.includes('(base)') || lower.includes('dal') || lower.includes('sabji');
}

export function WeeklyPlanView({
  planId,
  planNotes,
  templateEmoji,
  templateName,
  profiles,
  mealItems,
  weekStart,
  householdId,
}: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [activeProfile, setActiveProfile] = useState(profiles[0]?.id || '');
  const [showConsolidated, setShowConsolidated] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const profileData = profiles.find(p => p.id === activeProfile);
  const profileItems = useMemo(
    () => mealItems.filter(i => i.profile_id === activeProfile),
    [mealItems, activeProfile]
  );

  function getItemsForDayMeal(day: number, mealType: string): MealItem[] {
    return profileItems.filter(i => i.day_of_week === day && i.meal_type === mealType);
  }

  function getItemCalories(item: MealItem): number {
    if (item.custom_calories) return item.custom_calories;
    if (item.food_item) return item.food_item.calories_per_serving * item.servings;
    return 0;
  }

  function getItemProtein(item: MealItem): number {
    if (item.custom_protein_g) return item.custom_protein_g;
    if (item.food_item) return item.food_item.protein_g * item.servings;
    return 0;
  }

  function getItemCarbs(item: MealItem): number {
    if (item.custom_carbs_g) return item.custom_carbs_g;
    if (item.food_item) return item.food_item.carbs_g * item.servings;
    return 0;
  }

  function getItemFat(item: MealItem): number {
    if (item.custom_fat_g) return item.custom_fat_g;
    if (item.food_item) return item.food_item.fat_g * item.servings;
    return 0;
  }

  function getDayTotals(day: number) {
    const dayItems = profileItems.filter(i => i.day_of_week === day);
    return dayItems.reduce(
      (acc, item) => ({
        calories: acc.calories + getItemCalories(item),
        protein: acc.protein + getItemProtein(item),
        carbs: acc.carbs + getItemCarbs(item),
        fat: acc.fat + getItemFat(item),
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
  }

  function getItemDisplayName(item: MealItem): string {
    return item.notes || item.food_item?.name || 'Unknown item';
  }

  // Consolidated quantities across the week
  const consolidated = useMemo(() => {
    const map = new Map<string, {
      name: string;
      total_servings: number;
      total_calories: number;
      total_protein: number;
    }>();

    for (const item of profileItems) {
      const name = getItemDisplayName(item);
      const key = name.toLowerCase().replace(/\s*\(.*\)/, '').trim();
      const existing = map.get(key);
      if (existing) {
        existing.total_servings += item.servings;
        existing.total_calories += getItemCalories(item);
        existing.total_protein += getItemProtein(item);
      } else {
        map.set(key, {
          name: name.replace(/\s*\(.*\)/, '').trim(),
          total_servings: item.servings,
          total_calories: getItemCalories(item),
          total_protein: getItemProtein(item),
        });
      }
    }

    return Array.from(map.values()).sort((a, b) => b.total_calories - a.total_calories);
  }, [profileItems]);

  const weeklyTotals = useMemo(() => {
    return profileItems.reduce(
      (acc, item) => ({
        calories: acc.calories + getItemCalories(item),
        protein: acc.protein + getItemProtein(item),
        carbs: acc.carbs + getItemCarbs(item),
        fat: acc.fat + getItemFat(item),
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
  }, [profileItems]);

  async function handleDeletePlan() {
    if (!confirm('Delete this week\'s plan? You can generate a new one after.')) return;
    setDeleting(true);
    await supabase.from('meal_plans').delete().eq('id', planId);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {/* Plan header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {templateEmoji && <span className="text-2xl">{templateEmoji}</span>}
          {templateName && (
            <Badge variant="outline" className="text-sm font-medium">
              {templateName}
            </Badge>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleDeletePlan} disabled={deleting}>
            <RotateCcw className="h-4 w-4 mr-1" />
            {deleting ? 'Removing...' : 'Change Template'}
          </Button>
        </div>
      </div>

      {/* Person tabs */}
      {profiles.length > 1 && (
        <div className="flex gap-2">
          {profiles.map(p => (
            <button
              key={p.id}
              onClick={() => setActiveProfile(p.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeProfile === p.id
                  ? 'bg-green-700 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {p.full_name}
              <span className="ml-2 opacity-70">{p.target_calories} kcal</span>
            </button>
          ))}
        </div>
      )}

      {/* Weekly overview bar */}
      <Card className="bg-gradient-to-r from-green-50 to-blue-50 border-green-200">
        <CardContent className="py-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 uppercase font-medium">Weekly Average</p>
              <p className="text-lg font-bold">
                {Math.round(weeklyTotals.calories / 7)} kcal/day
              </p>
            </div>
            <div className="flex gap-6 text-sm">
              <div className="text-center">
                <p className="font-bold text-blue-600">{Math.round(weeklyTotals.protein / 7)}g</p>
                <p className="text-[10px] text-gray-400">protein/day</p>
              </div>
              <div className="text-center">
                <p className="font-bold text-amber-600">{Math.round(weeklyTotals.carbs / 7)}g</p>
                <p className="text-[10px] text-gray-400">carbs/day</p>
              </div>
              <div className="text-center">
                <p className="font-bold text-yellow-600">{Math.round(weeklyTotals.fat / 7)}g</p>
                <p className="text-[10px] text-gray-400">fat/day</p>
              </div>
            </div>
            {profileData && (
              <div className="text-right">
                <p className="text-xs text-gray-500">Target</p>
                <p className="text-sm font-medium">
                  {profileData.target_calories} kcal | {profileData.target_protein_g}g P
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Day cards */}
      <div className="grid grid-cols-1 gap-3">
        {DAYS_OF_WEEK.map((dayName, dayIndex) => {
          const totals = getDayTotals(dayIndex);
          const calTarget = profileData?.target_calories || 2000;
          const calPercent = Math.min(100, (totals.calories / calTarget) * 100);
          const protTarget = profileData?.target_protein_g || 80;
          const protPercent = Math.min(100, (totals.protein / protTarget) * 100);

          return (
            <Card key={dayIndex}>
              <CardHeader className="pb-2 pt-3 px-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold">{dayName}</CardTitle>
                  <div className="flex items-center gap-4 text-xs">
                    <span className={totals.calories > calTarget ? 'text-red-600 font-bold' : 'text-gray-600'}>
                      {Math.round(totals.calories)}/{calTarget} kcal
                    </span>
                    <span className={totals.protein >= protTarget ? 'text-green-600 font-bold' : 'text-blue-600'}>
                      {Math.round(totals.protein)}/{protTarget}g P
                      {totals.protein >= protTarget ? ' \u2713' : ''}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Progress value={calPercent} className="h-1 flex-1" />
                  <Progress value={protPercent} className="h-1 w-16" />
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <div className="grid grid-cols-4 gap-3">
                  {MEAL_ORDER.map(mt => {
                    const items = getItemsForDayMeal(dayIndex, mt);
                    return (
                      <div key={mt}>
                        <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1.5">
                          {MEAL_LABELS[mt]}
                        </p>
                        <div className="space-y-1">
                          {items.map(item => (
                            <div
                              key={item.id}
                              className={`text-xs rounded px-2 py-1 ${
                                isRotatingItem(item.notes)
                                  ? 'bg-blue-50 border border-blue-100'
                                  : 'bg-gray-50'
                              }`}
                            >
                              <p className="font-medium leading-tight truncate" title={getItemDisplayName(item)}>
                                {getItemDisplayName(item)}
                              </p>
                              <p className="text-gray-400 text-[10px]">
                                {item.servings}x &middot; {Math.round(getItemCalories(item))} cal
                                &middot; {Math.round(getItemProtein(item))}g P
                              </p>
                            </div>
                          ))}
                          {items.length === 0 && (
                            <p className="text-[10px] text-gray-300 italic">No items</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Consolidated quantities */}
      <Card>
        <CardHeader className="pb-2">
          <button
            className="flex items-center justify-between w-full"
            onClick={() => setShowConsolidated(!showConsolidated)}
          >
            <CardTitle className="text-base">Consolidated Weekly Quantities</CardTitle>
            {showConsolidated ? (
              <ChevronUp className="h-4 w-4 text-gray-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-gray-400" />
            )}
          </button>
        </CardHeader>
        {showConsolidated && (
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {consolidated.map((item, idx) => (
                <div key={idx} className="bg-gray-50 rounded-lg px-3 py-2">
                  <p className="text-sm font-medium truncate">{item.name}</p>
                  <p className="text-xs text-gray-500">
                    {item.total_servings} servings &middot; {Math.round(item.total_calories)} cal
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-3 border-t">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => router.push('/grocery')}
              >
                <ShoppingCart className="h-4 w-4 mr-2" />
                Generate Grocery List
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Legend */}
      <div className="flex items-center gap-4 text-[10px] text-gray-400 px-1">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-blue-50 border border-blue-100" />
          <span>Rotating item (changes daily)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-gray-50" />
          <span>Fixed item (same every day)</span>
        </div>
      </div>
    </div>
  );
}
