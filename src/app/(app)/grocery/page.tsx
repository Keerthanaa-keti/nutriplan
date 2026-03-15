import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { GROCERY_PLATFORMS } from '@/lib/nutrition/constants';
import { ShoppingCart, RefreshCw } from 'lucide-react';
import { GroceryListView } from '@/components/grocery/grocery-list-view';

export default async function GroceryPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: membership } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('profile_id', user.id)
    .single();

  if (!membership) return <p>Join a household first</p>;

  // Get latest grocery list
  const { data: groceryList } = await supabase
    .from('grocery_lists')
    .select('*, grocery_items:grocery_items(*, food_item:food_items(name, category, serving_unit))')
    .eq('household_id', membership.household_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  // Get current active plan
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const weekStart = monday.toISOString().split('T')[0];

  const { data: activePlan } = await supabase
    .from('meal_plans')
    .select('id')
    .eq('household_id', membership.household_id)
    .eq('week_start', weekStart)
    .single();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Grocery List</h1>
          <p className="text-gray-500">Auto-generated from your meal plan</p>
        </div>
        {activePlan && (
          <form action={async () => {
            'use server';
            const { createClient } = await import('@/lib/supabase/server');
            const supabase = await createClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: membership } = await supabase
              .from('household_members')
              .select('household_id')
              .eq('profile_id', user.id)
              .single();
            if (!membership) return;

            // Get meal plan items
            const { data: items } = await supabase
              .from('meal_plan_items')
              .select('food_item_id, servings, food_item:food_items(id, name, serving_size_g, serving_unit, category)')
              .eq('meal_plan_id', activePlan.id);

            if (!items) return;

            // Aggregate items
            const aggregated = new Map<string, { name: string; total_g: number; unit: string; category: string }>();
            for (const item of items) {
              const fi = (item as unknown as { food_item: { id: string; name: string; serving_size_g: number; serving_unit: string; category: string } }).food_item;
              if (!fi) continue;
              const existing = aggregated.get(fi.id);
              const qty = fi.serving_size_g * item.servings;
              if (existing) {
                existing.total_g += qty;
              } else {
                aggregated.set(fi.id, { name: fi.name, total_g: qty, unit: fi.serving_unit, category: fi.category });
              }
            }

            // Create grocery list
            const { data: list } = await supabase
              .from('grocery_lists')
              .insert({
                household_id: membership.household_id,
                meal_plan_id: activePlan.id,
                name: `Week of ${new Date().toLocaleDateString('en-IN')}`,
              })
              .select()
              .single();

            if (!list) return;

            // Insert items
            const groceryItems = Array.from(aggregated.entries()).map(([foodId, agg]) => ({
              grocery_list_id: list.id,
              food_item_id: foodId,
              quantity: Math.ceil(agg.total_g),
              unit: agg.unit,
              category: agg.category,
            }));

            await supabase.from('grocery_items').insert(groceryItems);

            const { redirect } = await import('next/navigation');
            redirect('/grocery');
          }}>
            <Button type="submit">
              <RefreshCw className="h-4 w-4 mr-2" />
              Generate from Meal Plan
            </Button>
          </form>
        )}
      </div>

      {groceryList ? (
        <GroceryListView list={groceryList} />
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <ShoppingCart className="h-12 w-12 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">No grocery list yet. Create a meal plan first, then generate a list.</p>
          </CardContent>
        </Card>
      )}

      {/* Platform Price Comparison Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Price Comparison Platforms</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {GROCERY_PLATFORMS.map((p) => (
              <Badge key={p.value} variant="outline" style={{ borderColor: p.color, color: p.color }}>
                {p.label}
              </Badge>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-2">Price comparison coming soon. Add prices manually for now.</p>
        </CardContent>
      </Card>
    </div>
  );
}
