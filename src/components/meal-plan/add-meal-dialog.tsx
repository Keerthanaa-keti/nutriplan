'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { DAYS_OF_WEEK, MEAL_TYPES } from '@/lib/nutrition/constants';
import type { FoodItem } from '@/types/database';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planId: string;
  profileId: string;
  dayOfWeek: number;
  mealType: string;
  dietType: string;
}

export function AddMealDialog({ open, onOpenChange, planId, profileId, dayOfWeek, mealType, dietType }: Props) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<FoodItem[]>([]);
  const [servings, setServings] = useState('1');
  const [selectedFood, setSelectedFood] = useState<FoodItem | null>(null);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    if (!search || search.length < 2) {
      setResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      let query = supabase
        .from('food_items')
        .select('*')
        .textSearch('search_vector', search.split(' ').join(' & '), { type: 'websearch' })
        .limit(15);

      // Filter by diet type
      if (dietType === 'veg') {
        query = query.eq('is_veg', true).eq('is_egg', false);
      } else if (dietType === 'egg') {
        query = query.or('is_veg.eq.true,is_egg.eq.true');
      }
      // non_veg gets everything

      const { data } = await query;
      setResults((data as FoodItem[]) || []);
    }, 300);
    return () => clearTimeout(timeout);
  }, [search, dietType, supabase]);

  async function addFood() {
    if (!selectedFood) return;
    setLoading(true);

    await supabase.from('meal_plan_items').insert({
      meal_plan_id: planId,
      profile_id: profileId,
      day_of_week: dayOfWeek,
      meal_type: mealType,
      food_item_id: selectedFood.id,
      servings: parseFloat(servings) || 1,
    });

    setLoading(false);
    setSearch('');
    setSelectedFood(null);
    setServings('1');
    onOpenChange(false);
    router.refresh();
  }

  const mealLabel = MEAL_TYPES.find(m => m.value === mealType)?.label || mealType;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add to {mealLabel} - {DAYS_OF_WEEK[dayOfWeek]}</DialogTitle>
        </DialogHeader>

        {selectedFood ? (
          <div className="space-y-4">
            <div className="bg-green-50 p-3 rounded-lg">
              <p className="font-medium">{selectedFood.name}</p>
              <div className="flex gap-3 text-sm text-gray-600 mt-1">
                <span>{selectedFood.calories_per_serving} cal</span>
                <span>{selectedFood.protein_g}g P</span>
                <span>{selectedFood.carbs_g}g C</span>
                <span>{selectedFood.fat_g}g F</span>
                <span className="text-gray-400">per {selectedFood.serving_size_g}{selectedFood.serving_unit}</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Servings</Label>
              <Input
                type="number"
                step="0.5"
                min="0.5"
                value={servings}
                onChange={(e) => setServings(e.target.value)}
              />
              <p className="text-sm text-gray-500">
                Total: {Math.round(selectedFood.calories_per_serving * (parseFloat(servings) || 1))} cal,{' '}
                {Math.round(selectedFood.protein_g * (parseFloat(servings) || 1))}g protein
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setSelectedFood(null)}>
                Back
              </Button>
              <Button className="flex-1" onClick={addFood} disabled={loading}>
                {loading ? 'Adding...' : 'Add to Plan'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <Input
              placeholder="Search foods... (e.g., chicken, dal, oats)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
            <div className="max-h-64 overflow-y-auto space-y-1">
              {results.map((food) => (
                <button
                  key={food.id}
                  className="w-full text-left p-2 rounded hover:bg-gray-50 flex items-center justify-between"
                  onClick={() => setSelectedFood(food)}
                >
                  <div>
                    <p className="text-sm font-medium">{food.name}</p>
                    <p className="text-xs text-gray-500">
                      {food.calories_per_serving} cal &middot; {food.protein_g}g P &middot;
                      {food.serving_size_g}{food.serving_unit}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {food.is_veg ? (food.is_egg ? 'Egg' : 'Veg') : 'Non-veg'}
                  </Badge>
                </button>
              ))}
              {search.length >= 2 && results.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">No foods found</p>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
