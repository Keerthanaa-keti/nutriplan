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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { household_id } = body;

    if (!household_id) {
      return jsonResponse({ error: 'household_id is required' }, 400);
    }

    // Fetch all food_delivery orders for this household
    const { data: orders, error: ordersError } = await supabase
      .from('order_history')
      .select('*')
      .eq('household_id', household_id)
      .eq('order_type', 'food_delivery');

    if (ordersError) {
      return jsonResponse({ error: ordersError.message }, 500);
    }

    if (!orders || orders.length === 0) {
      return jsonResponse({ message: 'No food delivery orders found', populated: 0 });
    }

    // Group dishes by name + restaurant
    const dishMap = new Map<string, {
      name: string;
      restaurant_name: string;
      platform: string;
      times_ordered: number;
      total_spent: number;
      prices: number[];
      is_veg: boolean;
      last_ordered_at: string;
    }>();

    for (const order of orders) {
      const items = order.items as Array<{
        name: string;
        quantity: number;
        price: number;
        is_veg?: boolean;
      }>;
      const restaurantName = order.raw_data?.restaurant_name || 'Unknown';
      const platform = order.platform || 'swiggy';
      const orderDate = order.order_date;

      if (!items) continue;

      for (const item of items) {
        const key = `${item.name.toLowerCase().trim()}||${restaurantName.toLowerCase().trim()}`;
        const existing = dishMap.get(key);
        const quantity = item.quantity || 1;
        const itemTotal = (item.price || 0) * quantity;

        if (existing) {
          existing.times_ordered += quantity;
          existing.total_spent += itemTotal;
          existing.prices.push(item.price || 0);
          if (orderDate > existing.last_ordered_at) {
            existing.last_ordered_at = orderDate;
          }
        } else {
          dishMap.set(key, {
            name: item.name,
            restaurant_name: restaurantName,
            platform,
            times_ordered: quantity,
            total_spent: itemTotal,
            prices: [item.price || 0],
            is_veg: item.is_veg ?? true,
            last_ordered_at: orderDate,
          });
        }
      }
    }

    // Build rows for restaurant_items
    const rows = Array.from(dishMap.values()).map(dish => ({
      household_id,
      name: dish.name,
      restaurant_name: dish.restaurant_name,
      platform: dish.platform,
      times_ordered: dish.times_ordered,
      total_spent: dish.total_spent,
      avg_price: dish.prices.length > 0
        ? Math.round((dish.prices.reduce((a, b) => a + b, 0) / dish.prices.length) * 100) / 100
        : null,
      is_veg: dish.is_veg,
      last_ordered_at: dish.last_ordered_at,
    }));

    // Upsert into restaurant_items (avoid duplicates by name + restaurant)
    let inserted = 0;
    let skipped = 0;

    for (const row of rows) {
      // Check if already exists
      const { data: existing } = await supabase
        .from('restaurant_items')
        .select('id')
        .eq('household_id', household_id)
        .eq('name', row.name)
        .eq('restaurant_name', row.restaurant_name)
        .limit(1);

      if (existing && existing.length > 0) {
        // Update stats on existing
        await supabase
          .from('restaurant_items')
          .update({
            times_ordered: row.times_ordered,
            total_spent: row.total_spent,
            avg_price: row.avg_price,
            last_ordered_at: row.last_ordered_at,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing[0].id);
        skipped++;
      } else {
        const { error: insertError } = await supabase
          .from('restaurant_items')
          .insert(row);
        if (!insertError) inserted++;
      }
    }

    return jsonResponse({
      success: true,
      total_dishes: dishMap.size,
      inserted,
      updated: skipped,
      from_orders: orders.length,
    });
  } catch (err) {
    console.error('Populate error:', err);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
}
