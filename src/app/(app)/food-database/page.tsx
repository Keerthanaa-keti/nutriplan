import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FOOD_CATEGORIES } from '@/lib/nutrition/constants';
import { FoodSearch } from '@/components/meal-plan/food-search';

export default async function FoodDatabasePage() {
  const supabase = await createClient();

  const { data: foods, count } = await supabase
    .from('food_items')
    .select('*', { count: 'exact' })
    .order('name')
    .limit(50);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Food Database</h1>
        <p className="text-gray-500">{count || 0} items in the database</p>
      </div>

      <FoodSearch />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {(foods || []).map((food) => (
          <Card key={food.id} className="hover:shadow-md transition-shadow">
            <CardContent className="pt-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-medium">{food.name}</p>
                  {food.name_local && <p className="text-xs text-gray-400">{food.name_local}</p>}
                </div>
                <Badge variant="outline" className="text-xs shrink-0">
                  {food.is_veg ? (food.is_egg ? 'Egg' : 'Veg') : 'Non-veg'}
                </Badge>
              </div>
              <div className="grid grid-cols-4 gap-2 text-center text-xs mt-3">
                <div className="bg-orange-50 rounded p-1.5">
                  <p className="font-bold text-orange-700">{food.calories_per_serving}</p>
                  <p className="text-gray-500">cal</p>
                </div>
                <div className="bg-blue-50 rounded p-1.5">
                  <p className="font-bold text-blue-700">{food.protein_g}g</p>
                  <p className="text-gray-500">protein</p>
                </div>
                <div className="bg-green-50 rounded p-1.5">
                  <p className="font-bold text-green-700">{food.carbs_g}g</p>
                  <p className="text-gray-500">carbs</p>
                </div>
                <div className="bg-yellow-50 rounded p-1.5">
                  <p className="font-bold text-yellow-700">{food.fat_g}g</p>
                  <p className="text-gray-500">fat</p>
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Per {food.serving_size_g}{food.serving_unit}
                {food.preferred_brand && ` · ${food.preferred_brand}`}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
