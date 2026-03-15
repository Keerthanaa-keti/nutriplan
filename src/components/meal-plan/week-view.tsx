'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { DAYS_OF_WEEK, MEAL_TYPES } from '@/lib/nutrition/constants';
import { AddMealDialog } from './add-meal-dialog';
import { Plus, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

interface Profile {
  id: string;
  full_name: string;
  target_calories: number;
  target_protein_g: number;
  target_carbs_g: number;
  target_fat_g: number;
  diet_type: string;
}

interface MealItem {
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
}

interface Props {
  planId: string;
  profiles: Profile[];
  mealItems: MealItem[];
  householdId: string;
}

export function MealPlanWeekView({ planId, profiles, mealItems, householdId }: Props) {
  const [activeProfile, setActiveProfile] = useState(profiles[0]?.id || '');
  const [addMealOpen, setAddMealOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState(0);
  const [selectedMealType, setSelectedMealType] = useState('breakfast');
  const supabase = createClient();
  const router = useRouter();

  const activeProfileData = profiles.find(p => p.id === activeProfile);

  function getItemsForDayMeal(day: number, mealType: string): MealItem[] {
    return mealItems.filter(
      (item) => item.profile_id === activeProfile && item.day_of_week === day && item.meal_type === mealType
    );
  }

  function getDayTotals(day: number) {
    const dayItems = mealItems.filter(i => i.profile_id === activeProfile && i.day_of_week === day);
    return dayItems.reduce(
      (acc, item) => {
        if (!item.food_item) return acc;
        return {
          calories: acc.calories + item.food_item.calories_per_serving * item.servings,
          protein: acc.protein + item.food_item.protein_g * item.servings,
          carbs: acc.carbs + item.food_item.carbs_g * item.servings,
          fat: acc.fat + item.food_item.fat_g * item.servings,
        };
      },
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
  }

  async function removeMealItem(itemId: string) {
    await supabase.from('meal_plan_items').delete().eq('id', itemId);
    router.refresh();
  }

  function openAddMeal(day: number, mealType: string) {
    setSelectedDay(day);
    setSelectedMealType(mealType);
    setAddMealOpen(true);
  }

  return (
    <div className="space-y-4">
      {/* Person Tabs */}
      {profiles.length > 1 && (
        <Tabs value={activeProfile} onValueChange={setActiveProfile}>
          <TabsList>
            {profiles.map((p) => (
              <TabsTrigger key={p.id} value={p.id}>
                {p.full_name}
                <Badge variant="outline" className="ml-2 text-xs">{p.target_calories} kcal</Badge>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}

      {/* Week Grid */}
      <div className="grid grid-cols-1 gap-4">
        {DAYS_OF_WEEK.map((dayName, dayIndex) => {
          const totals = getDayTotals(dayIndex);
          const calTarget = activeProfileData?.target_calories || 2000;
          const calPercent = Math.min(100, (totals.calories / calTarget) * 100);

          return (
            <Card key={dayIndex}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{dayName}</CardTitle>
                  <div className="flex items-center gap-4 text-sm">
                    <span className={totals.calories > calTarget ? 'text-red-600 font-medium' : 'text-gray-600'}>
                      {Math.round(totals.calories)} / {calTarget} kcal
                    </span>
                    <span className="text-blue-600">{Math.round(totals.protein)}g P</span>
                    <span className="text-orange-600">{Math.round(totals.carbs)}g C</span>
                    <span className="text-yellow-600">{Math.round(totals.fat)}g F</span>
                  </div>
                </div>
                <Progress value={calPercent} className="h-1.5" />
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-5 gap-3">
                  {MEAL_TYPES.map((mt) => {
                    const items = getItemsForDayMeal(dayIndex, mt.value);
                    return (
                      <div key={mt.value} className="space-y-1">
                        <p className="text-xs font-medium text-gray-500 uppercase">{mt.label}</p>
                        {items.map((item) => (
                          <div key={item.id} className="flex items-start gap-1 text-xs bg-gray-50 rounded p-1.5 group">
                            <div className="flex-1">
                              <p className="font-medium leading-tight">{item.food_item?.name}</p>
                              <p className="text-gray-400">
                                {item.servings}x &middot; {Math.round((item.food_item?.calories_per_serving || 0) * item.servings)} cal
                              </p>
                            </div>
                            <button
                              onClick={() => removeMealItem(item.id)}
                              className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() => openAddMeal(dayIndex, mt.value)}
                          className="w-full text-xs text-gray-400 hover:text-green-600 hover:bg-green-50 rounded p-1 flex items-center justify-center gap-1"
                        >
                          <Plus className="h-3 w-3" /> Add
                        </button>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <AddMealDialog
        open={addMealOpen}
        onOpenChange={setAddMealOpen}
        planId={planId}
        profileId={activeProfile}
        dayOfWeek={selectedDay}
        mealType={selectedMealType}
        dietType={activeProfileData?.diet_type || 'non_veg'}
      />
    </div>
  );
}
