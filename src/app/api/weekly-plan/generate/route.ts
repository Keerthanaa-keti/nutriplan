import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface MasterItem {
  id: string;
  name: string;
  category: string;
  calories_per_serving: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  daily_quantity: number | null;
  cost_per_day: number | null;
  cost_per_week: number | null;
  serving_size_g: number | null;
  serving_unit: string | null;
  brand: string | null;
  is_active: boolean;
}

// Rotation patterns for lunch base grain (0=Mon .. 6=Sun)
// Roti on Mon(0), Wed(2), Fri(4) | Rice on Tue(1), Thu(3) | Millet on Sat(5), Sun(6)
const GRAIN_ROTATION: Record<number, string> = {
  0: 'roti',
  1: 'rice',
  2: 'roti',
  3: 'rice',
  4: 'roti',
  5: 'millet',
  6: 'millet',
};

// Dal rotation
const DAL_ROTATION: Record<number, string> = {
  0: 'moong',
  1: 'toor',
  2: 'masoor',
  3: 'moong',
  4: 'toor',
  5: 'masoor',
  6: 'moong',
};

function findItem(items: MasterItem[], ...keywords: string[]): MasterItem | null {
  for (const kw of keywords) {
    const found = items.find(i =>
      i.is_active && i.name.toLowerCase().includes(kw.toLowerCase())
    );
    if (found) return found;
  }
  return null;
}

function findItemByCategory(items: MasterItem[], category: string): MasterItem | null {
  return items.find(i => i.is_active && i.category === category) || null;
}

function findAllByCategory(items: MasterItem[], category: string): MasterItem[] {
  return items.filter(i => i.is_active && i.category === category);
}

interface DayMeal {
  meal_type: string;
  items: { master_item: MasterItem; servings: number; label: string }[];
}

interface DayPlan {
  day: number;
  day_name: string;
  meals: DayMeal[];
}

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { template_id, profile_id, week_start } = body;

    if (!template_id || !profile_id || !week_start) {
      return NextResponse.json(
        { error: 'template_id, profile_id, and week_start are required' },
        { status: 400 }
      );
    }

    // Get the template
    const { data: template, error: templateError } = await supabase
      .from('weekly_plan_templates')
      .select('*')
      .eq('id', template_id)
      .single();

    if (templateError || !template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Get user's master_food_list
    const { data: masterItems, error: masterError } = await supabase
      .from('master_food_list')
      .select('*')
      .eq('profile_id', profile_id)
      .eq('is_active', true);

    if (masterError || !masterItems || masterItems.length === 0) {
      return NextResponse.json(
        { error: 'No items in master food list. Please populate your master database first.' },
        { status: 400 }
      );
    }

    // Get user's household
    const { data: membership } = await supabase
      .from('household_members')
      .select('household_id')
      .eq('profile_id', profile_id)
      .single();

    if (!membership) {
      return NextResponse.json({ error: 'User not in a household' }, { status: 400 });
    }

    const proteinTheme = template.protein_theme as string;

    // Find items from master list by name/category
    const eggs = findItem(masterItems, 'egg', 'omelette');
    const rice = findItem(masterItems, 'rice');
    const roti = findItem(masterItems, 'roti', 'chapati');
    const millet = findItem(masterItems, 'millet', 'ragi', 'jowar', 'bajra');
    const moongDal = findItem(masterItems, 'moong');
    const toorDal = findItem(masterItems, 'toor');
    const masoorDal = findItem(masterItems, 'masoor', 'lentil');
    const paneer = findItem(masterItems, 'paneer');
    const chicken = findItem(masterItems, 'chicken');
    const sprouts = findItem(masterItems, 'sprout');
    const vegetables = findItem(masterItems, 'vegetable', 'mixed veg', 'sabji');
    const curd = findItem(masterItems, 'curd', 'yogurt', 'dahi');
    const pomegranate = findItem(masterItems, 'pomegranate', 'fruit');
    const peanutButter = findItem(masterItems, 'peanut butter', 'pintola');
    const mixedNuts = findItem(masterItems, 'nuts', 'mixed nuts', 'almonds');
    const wheyProtein = findItem(masterItems, 'whey', 'protein powder');
    const banana = findItem(masterItems, 'banana');
    const cookingOil = findItem(masterItems, 'oil', 'cooking oil');
    const milk = findItem(masterItems, 'milk');

    // Build grain rotation map
    const grainMap: Record<string, MasterItem | null> = {
      roti: roti,
      rice: rice,
      millet: millet || rice, // fallback to rice if no millet
    };

    // Build dal rotation map
    const dalMap: Record<string, MasterItem | null> = {
      moong: moongDal,
      toor: toorDal,
      masoor: masoorDal || toorDal, // fallback
    };

    // Determine protein item based on template theme
    let lunchProtein: MasterItem | null = null;
    switch (proteinTheme) {
      case 'egg_paneer':
        lunchProtein = paneer;
        break;
      case 'egg_chicken':
        lunchProtein = chicken;
        break;
      case 'egg_sprouts':
        lunchProtein = sprouts || findItemByCategory(masterItems, 'dal');
        break;
      case 'paneer_lentils':
        lunchProtein = paneer;
        break;
    }

    // Generate 7 days
    const weekPlan: DayPlan[] = [];

    for (let day = 0; day < 7; day++) {
      const dayMeals: DayMeal[] = [];

      // BREAKFAST (fixed)
      const breakfastItems: DayMeal['items'] = [];
      if (proteinTheme !== 'paneer_lentils' && eggs) {
        breakfastItems.push({
          master_item: eggs,
          servings: eggs.daily_quantity || 3,
          label: 'Eggs (omelette)',
        });
      }
      if (proteinTheme === 'paneer_lentils' && paneer) {
        breakfastItems.push({
          master_item: paneer,
          servings: 1,
          label: 'Paneer paratha',
        });
      }
      if (milk) {
        breakfastItems.push({
          master_item: milk,
          servings: milk.daily_quantity || 1,
          label: 'Milk',
        });
      }
      dayMeals.push({ meal_type: 'breakfast', items: breakfastItems });

      // LUNCH (rotating)
      const lunchItems: DayMeal['items'] = [];
      const grainKey = GRAIN_ROTATION[day];
      const dalKey = DAL_ROTATION[day];
      const grainItem = grainMap[grainKey];
      const dalItem = dalMap[dalKey];

      if (grainItem) {
        lunchItems.push({
          master_item: grainItem,
          servings: grainItem.daily_quantity || 1,
          label: `${grainKey.charAt(0).toUpperCase() + grainKey.slice(1)} (base)`,
        });
      }
      if (dalItem) {
        lunchItems.push({
          master_item: dalItem,
          servings: dalItem.daily_quantity || 1,
          label: `${dalKey.charAt(0).toUpperCase() + dalKey.slice(1)} dal`,
        });
      }
      if (vegetables) {
        lunchItems.push({
          master_item: vegetables,
          servings: vegetables.daily_quantity || 1,
          label: 'Sabji',
        });
      }
      if (lunchProtein) {
        lunchItems.push({
          master_item: lunchProtein,
          servings: lunchProtein.daily_quantity || 1,
          label: `${lunchProtein.name} (protein)`,
        });
      }
      if (cookingOil) {
        lunchItems.push({
          master_item: cookingOil,
          servings: cookingOil.daily_quantity || 1,
          label: 'Cooking oil',
        });
      }
      dayMeals.push({ meal_type: 'lunch', items: lunchItems });

      // DINNER (fixed - light)
      const dinnerItems: DayMeal['items'] = [];
      if (curd) {
        dinnerItems.push({
          master_item: curd,
          servings: curd.daily_quantity || 1,
          label: 'Curd',
        });
      }
      if (pomegranate) {
        dinnerItems.push({
          master_item: pomegranate,
          servings: pomegranate.daily_quantity || 1,
          label: 'Pomegranate',
        });
      }
      if (peanutButter) {
        dinnerItems.push({
          master_item: peanutButter,
          servings: peanutButter.daily_quantity || 1,
          label: 'Peanut butter',
        });
      }
      dayMeals.push({ meal_type: 'dinner', items: dinnerItems });

      // SNACKS (fixed)
      const snackItems: DayMeal['items'] = [];
      if (mixedNuts) {
        snackItems.push({
          master_item: mixedNuts,
          servings: mixedNuts.daily_quantity || 1,
          label: 'Mixed nuts',
        });
      }
      if (wheyProtein) {
        snackItems.push({
          master_item: wheyProtein,
          servings: wheyProtein.daily_quantity || 1,
          label: 'Whey protein',
        });
      }
      if (banana) {
        snackItems.push({
          master_item: banana,
          servings: banana.daily_quantity || 1,
          label: 'Banana',
        });
      }
      dayMeals.push({ meal_type: 'snack_pm', items: snackItems });

      weekPlan.push({
        day,
        day_name: DAY_NAMES[day],
        meals: dayMeals,
      });
    }

    // Create meal_plan in Supabase
    const { data: plan, error: planError } = await supabase
      .from('meal_plans')
      .insert({
        household_id: membership.household_id,
        week_start: week_start,
        status: 'active',
        template_id: template_id,
        created_by: profile_id,
        notes: `Generated from template: ${template.name}`,
      })
      .select()
      .single();

    if (planError || !plan) {
      return NextResponse.json(
        { error: `Failed to create meal plan: ${planError?.message || 'Unknown error'}` },
        { status: 500 }
      );
    }

    // We need food_items for each master_food_list item.
    // Since meal_plan_items references food_items(id), we need to find or create food_items.
    // For now, we store data via custom_* columns and use notes for the name.
    // We'll insert meal_plan_items with custom macros from master_food_list.
    const mealPlanItems: {
      meal_plan_id: string;
      profile_id: string;
      day_of_week: number;
      meal_type: string;
      food_item_id: string | null;
      servings: number;
      custom_calories: number | null;
      custom_protein_g: number | null;
      custom_carbs_g: number | null;
      custom_fat_g: number | null;
      notes: string;
      is_cheat: boolean;
    }[] = [];

    // Try to match master items to food_items table
    const masterToFoodItem = new Map<string, string | null>();

    for (const dayPlan of weekPlan) {
      for (const meal of dayPlan.meals) {
        for (const item of meal.items) {
          const masterId = item.master_item.id;
          if (!masterToFoodItem.has(masterId)) {
            // Try to find matching food_item by name
            const { data: foodItem } = await supabase
              .from('food_items')
              .select('id')
              .ilike('name', `%${item.master_item.name.split(' ')[0]}%`)
              .limit(1)
              .single();
            masterToFoodItem.set(masterId, foodItem?.id || null);
          }
        }
      }
    }

    for (const dayPlan of weekPlan) {
      for (const meal of dayPlan.meals) {
        for (const item of meal.items) {
          const foodItemId = masterToFoodItem.get(item.master_item.id) || null;
          mealPlanItems.push({
            meal_plan_id: plan.id,
            profile_id: profile_id,
            day_of_week: dayPlan.day,
            meal_type: meal.meal_type,
            food_item_id: foodItemId,
            servings: item.servings,
            custom_calories: (item.master_item.calories_per_serving || 0) * item.servings,
            custom_protein_g: (item.master_item.protein_g || 0) * item.servings,
            custom_carbs_g: (item.master_item.carbs_g || 0) * item.servings,
            custom_fat_g: (item.master_item.fat_g || 0) * item.servings,
            notes: item.label,
            is_cheat: false,
          });
        }
      }
    }

    // Insert all meal plan items
    if (mealPlanItems.length > 0) {
      const { error: itemsError } = await supabase
        .from('meal_plan_items')
        .insert(mealPlanItems);

      if (itemsError) {
        console.error('Failed to insert meal plan items:', itemsError);
        // Don't fail completely - the plan was created
      }
    }

    // Calculate totals
    const dailyTotals = weekPlan.map(dayPlan => {
      let cal = 0, prot = 0, carbs = 0, fat = 0, cost = 0;
      for (const meal of dayPlan.meals) {
        for (const item of meal.items) {
          const s = item.servings;
          cal += (item.master_item.calories_per_serving || 0) * s;
          prot += (item.master_item.protein_g || 0) * s;
          carbs += (item.master_item.carbs_g || 0) * s;
          fat += (item.master_item.fat_g || 0) * s;
          cost += (item.master_item.cost_per_day || 0);
        }
      }
      return {
        day: dayPlan.day,
        day_name: dayPlan.day_name,
        calories: Math.round(cal),
        protein_g: Math.round(prot),
        carbs_g: Math.round(carbs),
        fat_g: Math.round(fat),
        cost: Math.round(cost),
      };
    });

    // Consolidated quantities
    const consolidated = new Map<string, {
      name: string;
      total_servings: number;
      serving_unit: string;
      serving_size_g: number;
      total_grams: number;
      cost_per_week: number;
    }>();

    for (const dayPlan of weekPlan) {
      for (const meal of dayPlan.meals) {
        for (const item of meal.items) {
          const key = item.master_item.id;
          const existing = consolidated.get(key);
          const servSizeG = item.master_item.serving_size_g || 100;
          if (existing) {
            existing.total_servings += item.servings;
            existing.total_grams += item.servings * servSizeG;
          } else {
            consolidated.set(key, {
              name: item.master_item.name,
              total_servings: item.servings,
              serving_unit: item.master_item.serving_unit || 'serving',
              serving_size_g: servSizeG,
              total_grams: item.servings * servSizeG,
              cost_per_week: item.master_item.cost_per_week || 0,
            });
          }
        }
      }
    }

    const weeklyTotals = dailyTotals.reduce(
      (acc, d) => ({
        calories: acc.calories + d.calories,
        protein_g: acc.protein_g + d.protein_g,
        cost: acc.cost + d.cost,
      }),
      { calories: 0, protein_g: 0, cost: 0 }
    );

    return NextResponse.json({
      success: true,
      plan_id: plan.id,
      template: {
        name: template.name,
        emoji: template.emoji,
        protein_theme: template.protein_theme,
      },
      week_start,
      daily_totals: dailyTotals,
      weekly_totals: weeklyTotals,
      consolidated_quantities: Array.from(consolidated.values()),
      days: weekPlan.map(d => ({
        day: d.day,
        day_name: d.day_name,
        meals: d.meals.map(m => ({
          meal_type: m.meal_type,
          items: m.items.map(i => ({
            name: i.master_item.name,
            label: i.label,
            servings: i.servings,
            calories: Math.round((i.master_item.calories_per_serving || 0) * i.servings),
            protein_g: Math.round((i.master_item.protein_g || 0) * i.servings),
          })),
        })),
      })),
    });
  } catch (err) {
    console.error('Generate weekly plan error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
