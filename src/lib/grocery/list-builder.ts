import { MealPlanItem, FoodItem, PantryItem, GroceryItem } from '@/types/database';

interface AggregatedItem {
  food_item_id: string;
  food_item: FoodItem;
  total_quantity_g: number;
  unit: string;
  category: string;
}

export function buildGroceryList(
  mealPlanItems: (MealPlanItem & { food_item: FoodItem })[],
  pantryItems: PantryItem[],
  daysInWeek: number = 7
): Omit<GroceryItem, 'id' | 'grocery_list_id' | 'is_checked'>[] {
  // Aggregate quantities per food item
  const aggregated = new Map<string, AggregatedItem>();

  for (const item of mealPlanItems) {
    if (!item.food_item) continue;
    const key = item.food_item_id;
    const existing = aggregated.get(key);
    const quantity = item.food_item.serving_size_g * item.servings;

    if (existing) {
      existing.total_quantity_g += quantity;
    } else {
      aggregated.set(key, {
        food_item_id: key,
        food_item: item.food_item,
        total_quantity_g: quantity,
        unit: item.food_item.serving_unit,
        category: item.food_item.category,
      });
    }
  }

  // Subtract pantry quantities
  const pantryMap = new Map<string, number>();
  for (const p of pantryItems) {
    if (p.food_item_id && p.status !== 'finished') {
      pantryMap.set(p.food_item_id, (pantryMap.get(p.food_item_id) || 0) + (p.quantity_remaining || 0));
    }
  }

  const groceryItems: Omit<GroceryItem, 'id' | 'grocery_list_id' | 'is_checked'>[] = [];

  for (const [foodId, agg] of aggregated) {
    const inPantry = pantryMap.get(foodId) || 0;
    const needed = agg.total_quantity_g - inPantry;

    if (needed > 0) {
      groceryItems.push({
        food_item_id: foodId,
        quantity: Math.ceil(needed),
        unit: agg.unit,
        category: agg.category,
      });
    }
  }

  // Sort by category
  return groceryItems.sort((a, b) => (a.category || '').localeCompare(b.category || ''));
}

export function findBestPrice(prices: { platform: string; price: number; pack_quantity: number }[]) {
  if (!prices.length) return null;
  return prices.reduce((best, p) => {
    const pricePerUnit = p.price / p.pack_quantity;
    const bestPerUnit = best.price / best.pack_quantity;
    return pricePerUnit < bestPerUnit ? p : best;
  });
}
