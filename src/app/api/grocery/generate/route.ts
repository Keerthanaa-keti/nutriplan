import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function jsonResponse(data: object, status = 200) {
  return NextResponse.json(data, { status, headers: corsHeaders });
}

export async function OPTIONS() {
  return jsonResponse({});
}

interface GroceryDayItem {
  id: string;
  name: string;
  brand: string | null;
  category: string;
  quantity: number;
  unit: string;
  estimated_cost: number | null;
  platform: string | null;
  shelf_life_days: number | null;
  daily_quantity: number;
}

interface DayOrder {
  day: string;
  date: string;
  items: GroceryDayItem[];
  total_items: number;
  total_cost: number;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { profile_id, household_id, week_start } = body;

    if (!profile_id) {
      return jsonResponse({ error: 'profile_id is required' }, 400);
    }

    // Calculate week_start (Monday) if not provided
    let mondayDate: Date;
    if (week_start) {
      mondayDate = new Date(week_start);
    } else {
      const today = new Date();
      const dayOfWeek = today.getDay();
      const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      mondayDate = new Date(today);
      mondayDate.setDate(today.getDate() + diff);
    }
    const thursdayDate = new Date(mondayDate);
    thursdayDate.setDate(mondayDate.getDate() + 3);

    const mondayStr = mondayDate.toISOString().split('T')[0];
    const thursdayStr = thursdayDate.toISOString().split('T')[0];

    // Fetch active master_food_list items for this user
    let query = supabase
      .from('master_food_list')
      .select('*')
      .eq('profile_id', profile_id)
      .eq('is_active', true)
      .gt('daily_quantity', 0);

    if (household_id) {
      query = query.eq('household_id', household_id);
    }

    const { data: items, error } = await query.order('category').order('name');

    if (error) {
      return jsonResponse({ error: error.message }, 500);
    }

    if (!items || items.length === 0) {
      return jsonResponse({
        error: 'No active items in master database. Add items first.',
      }, 404);
    }

    // Build Monday order (full week - all items)
    const mondayItems: GroceryDayItem[] = [];
    const thursdayItems: GroceryDayItem[] = [];

    for (const item of items) {
      const dailyQty = Number(item.daily_quantity) || 0;
      const weeklyQty = Math.ceil(dailyQty * 7);
      const costPerServing = item.cost_per_unit && item.pack_size
        ? Number(item.cost_per_unit) / Number(item.pack_size)
        : null;
      const weeklyCost = costPerServing ? costPerServing * weeklyQty : null;

      // Monday: everything
      mondayItems.push({
        id: item.id,
        name: item.name,
        brand: item.brand,
        category: item.category,
        quantity: weeklyQty,
        unit: item.serving_unit || item.pack_unit || 'unit',
        estimated_cost: weeklyCost ? Math.round(weeklyCost * 100) / 100 : null,
        platform: item.preferred_platform,
        shelf_life_days: item.shelf_life_days,
        daily_quantity: dailyQty,
      });

      // Thursday: only items with shelf_life_days <= 3 (fresh items)
      const shelfLife = item.shelf_life_days;
      if (shelfLife !== null && shelfLife !== undefined && shelfLife <= 3) {
        const halfWeekQty = Math.ceil(dailyQty * 3.5);
        const halfWeekCost = costPerServing ? costPerServing * halfWeekQty : null;

        thursdayItems.push({
          id: item.id,
          name: item.name,
          brand: item.brand,
          category: item.category,
          quantity: halfWeekQty,
          unit: item.serving_unit || item.pack_unit || 'unit',
          estimated_cost: halfWeekCost ? Math.round(halfWeekCost * 100) / 100 : null,
          platform: item.preferred_platform,
          shelf_life_days: shelfLife,
          daily_quantity: dailyQty,
        });
      }
    }

    const mondayCost = mondayItems.reduce((sum, i) => sum + (i.estimated_cost || 0), 0);
    const thursdayCost = thursdayItems.reduce((sum, i) => sum + (i.estimated_cost || 0), 0);

    const monday: DayOrder = {
      day: 'Monday',
      date: mondayStr,
      items: mondayItems,
      total_items: mondayItems.length,
      total_cost: Math.round(mondayCost * 100) / 100,
    };

    const thursday: DayOrder = {
      day: 'Thursday',
      date: thursdayStr,
      items: thursdayItems,
      total_items: thursdayItems.length,
      total_cost: Math.round(thursdayCost * 100) / 100,
    };

    // Platform summary
    const platformMap = new Map<string, { items: number; cost: number }>();
    for (const item of [...mondayItems, ...thursdayItems]) {
      const platform = item.platform || 'manual';
      const existing = platformMap.get(platform) || { items: 0, cost: 0 };
      existing.items += 1;
      existing.cost += item.estimated_cost || 0;
      platformMap.set(platform, existing);
    }

    const platform_summary = Array.from(platformMap.entries()).map(([platform, stats]) => ({
      platform,
      items: stats.items,
      cost: Math.round(stats.cost * 100) / 100,
    })).sort((a, b) => b.cost - a.cost);

    return jsonResponse({
      success: true,
      week_start: mondayStr,
      monday,
      thursday,
      grand_total: Math.round((mondayCost + thursdayCost) * 100) / 100,
      platform_summary,
    });
  } catch (err) {
    console.error('Grocery generate error:', err);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
}
