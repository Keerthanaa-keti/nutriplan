import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Simple auth for ClawdBot bridge -- validates service key header
const BRIDGE_KEY = process.env.CLAWDBOT_BRIDGE_KEY || 'clawdbot-nutriplan-bridge';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Service-Key',
};

function jsonResponse(data: object, status = 200) {
  return NextResponse.json(data, { status, headers: corsHeaders });
}

function unauthorized() {
  return jsonResponse({ error: 'Unauthorized -- provide X-Service-Key header' }, 401);
}

function validateKey(request: NextRequest): boolean {
  const key = request.headers.get('X-Service-Key');
  return key === BRIDGE_KEY;
}

async function resolveProfile(memberName: string) {
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name')
    .ilike('full_name', `%${memberName}%`)
    .limit(1);

  if (!profiles || profiles.length === 0) return null;

  const profile = profiles[0];

  // Also get household
  const { data: membership } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('profile_id', profile.id)
    .single();

  return {
    profile_id: profile.id,
    full_name: profile.full_name,
    household_id: membership?.household_id || null,
  };
}

// ---------- GET handlers ----------

async function handleGroceryList(memberName: string) {
  const user = await resolveProfile(memberName);
  if (!user) return jsonResponse({ error: `User "${memberName}" not found` }, 404);

  // Call the grocery generate logic inline
  const today = new Date();
  const dayOfWeek = today.getDay();
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const mondayDate = new Date(today);
  mondayDate.setDate(today.getDate() + diff);
  const thursdayDate = new Date(mondayDate);
  thursdayDate.setDate(mondayDate.getDate() + 3);

  const mondayStr = mondayDate.toISOString().split('T')[0];
  const thursdayStr = thursdayDate.toISOString().split('T')[0];

  const { data: items, error } = await supabase
    .from('master_food_list')
    .select('*')
    .eq('profile_id', user.profile_id)
    .eq('is_active', true)
    .gt('daily_quantity', 0)
    .order('category')
    .order('name');

  if (error) return jsonResponse({ error: error.message }, 500);
  if (!items || items.length === 0) {
    return jsonResponse({ error: 'No active items in master database' }, 404);
  }

  const mondayItems: { name: string; brand: string | null; category: string; quantity: number; unit: string; cost: number | null; platform: string | null }[] = [];
  const thursdayItems: typeof mondayItems = [];

  for (const item of items) {
    const dailyQty = Number(item.daily_quantity) || 0;
    const weeklyQty = Math.ceil(dailyQty * 7);
    const costPerServing = item.cost_per_unit && item.pack_size
      ? Number(item.cost_per_unit) / Number(item.pack_size)
      : null;
    const weeklyCost = costPerServing ? Math.round(costPerServing * weeklyQty * 100) / 100 : null;

    mondayItems.push({
      name: item.name,
      brand: item.brand,
      category: item.category,
      quantity: weeklyQty,
      unit: item.serving_unit || item.pack_unit || 'unit',
      cost: weeklyCost,
      platform: item.preferred_platform,
    });

    const shelfLife = item.shelf_life_days;
    if (shelfLife !== null && shelfLife !== undefined && shelfLife <= 3) {
      const halfWeekQty = Math.ceil(dailyQty * 3.5);
      const halfWeekCost = costPerServing ? Math.round(costPerServing * halfWeekQty * 100) / 100 : null;
      thursdayItems.push({
        name: item.name,
        brand: item.brand,
        category: item.category,
        quantity: halfWeekQty,
        unit: item.serving_unit || item.pack_unit || 'unit',
        cost: halfWeekCost,
        platform: item.preferred_platform,
      });
    }
  }

  const mondayTotal = mondayItems.reduce((sum, i) => sum + (i.cost || 0), 0);
  const thursdayTotal = thursdayItems.reduce((sum, i) => sum + (i.cost || 0), 0);

  // Format for WhatsApp
  const formatItems = (list: typeof mondayItems) => {
    const byCategory = new Map<string, typeof mondayItems>();
    for (const item of list) {
      const cat = item.category || 'other';
      if (!byCategory.has(cat)) byCategory.set(cat, []);
      byCategory.get(cat)!.push(item);
    }
    const lines: string[] = [];
    for (const [cat, catItems] of byCategory) {
      lines.push(`*${cat.charAt(0).toUpperCase() + cat.slice(1)}:*`);
      for (const item of catItems) {
        const brandStr = item.brand ? ` (${item.brand})` : '';
        const costStr = item.cost ? ` - Rs.${item.cost}` : '';
        lines.push(`  ${item.quantity} ${item.unit} ${item.name}${brandStr}${costStr}`);
      }
    }
    return lines.join('\n');
  };

  const whatsappMessage = [
    `*MONDAY ORDER (${mondayStr}):*`,
    formatItems(mondayItems),
    `Total: ~Rs.${Math.round(mondayTotal)}`,
    '',
    `*THURSDAY RESTOCK (${thursdayStr}):*`,
    formatItems(thursdayItems),
    `Total: ~Rs.${Math.round(thursdayTotal)}`,
    '',
    `*Week total: ~Rs.${Math.round(mondayTotal + thursdayTotal)}*`,
  ].join('\n');

  return jsonResponse({
    success: true,
    user: user.full_name,
    monday: { date: mondayStr, items: mondayItems, total: Math.round(mondayTotal) },
    thursday: { date: thursdayStr, items: thursdayItems, total: Math.round(thursdayTotal) },
    grand_total: Math.round(mondayTotal + thursdayTotal),
    whatsapp_message: whatsappMessage,
  });
}

async function handleWeeklyPlan(memberName: string) {
  const user = await resolveProfile(memberName);
  if (!user) return jsonResponse({ error: `User "${memberName}" not found` }, 404);

  // Get current week's meal plan
  const today = new Date();
  const dayOfWeek = today.getDay();
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const mondayDate = new Date(today);
  mondayDate.setDate(today.getDate() + diff);
  const mondayStr = mondayDate.toISOString().split('T')[0];

  const { data: plans, error } = await supabase
    .from('meal_plans')
    .select('*, meal_plan_items(*)')
    .eq('profile_id', user.profile_id)
    .gte('week_start', mondayStr)
    .order('week_start', { ascending: false })
    .limit(1);

  if (error) return jsonResponse({ error: error.message }, 500);

  if (!plans || plans.length === 0) {
    return jsonResponse({
      success: true,
      user: user.full_name,
      has_plan: false,
      whatsapp_message: [
        `No weekly plan found for ${user.full_name} this week.`,
        '',
        'Suggested templates:',
        '1. Egg + Paneer Week',
        '2. Egg + Chicken Week',
        '3. Egg + Sprouts Week',
        '4. Paneer + Lentils Week',
        '',
        'Reply with a number to create a plan.',
      ].join('\n'),
    });
  }

  const plan = plans[0];
  const items = plan.meal_plan_items || [];

  // Group by day
  const byDay = new Map<string, typeof items>();
  for (const item of items) {
    const day = item.day_of_week || 'unassigned';
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day)!.push(item);
  }

  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const lines: string[] = [`*Weekly Plan (${mondayStr}):*`, ''];

  for (const day of dayNames) {
    const dayItems = byDay.get(day.toLowerCase()) || byDay.get(day) || [];
    if (dayItems.length === 0) continue;
    lines.push(`*${day}:*`);
    for (const item of dayItems) {
      lines.push(`  ${item.meal_type}: ${item.food_name || item.name} (${item.quantity || 1} ${item.unit || 'serving'})`);
    }
  }

  // Add macro summary if available
  if (plan.total_calories) {
    lines.push('');
    lines.push(`Daily target: ${plan.total_calories} kcal, ${plan.total_protein || '?'}g protein`);
  }

  return jsonResponse({
    success: true,
    user: user.full_name,
    has_plan: true,
    plan_id: plan.id,
    week_start: plan.week_start,
    whatsapp_message: lines.join('\n'),
  });
}

async function handleOrderHistory(memberName: string, limit = 5) {
  const user = await resolveProfile(memberName);
  if (!user) return jsonResponse({ error: `User "${memberName}" not found` }, 404);

  const { data: orders, error } = await supabase
    .from('order_history')
    .select('id, platform, order_date, order_type, total_amount, items')
    .eq('profile_id', user.profile_id)
    .order('order_date', { ascending: false })
    .limit(limit);

  if (error) return jsonResponse({ error: error.message }, 500);

  if (!orders || orders.length === 0) {
    return jsonResponse({
      success: true,
      user: user.full_name,
      orders: [],
      whatsapp_message: `No order history found for ${user.full_name}. Try "import my BigBasket orders" to get started.`,
    });
  }

  const lines: string[] = [`*Recent Orders (${user.full_name}):*`, ''];
  for (const order of orders) {
    const itemCount = Array.isArray(order.items) ? order.items.length : 0;
    const date = order.order_date ? new Date(order.order_date).toLocaleDateString('en-IN') : '?';
    lines.push(`${date} | ${order.platform} (${order.order_type}) | Rs.${order.total_amount || 0} | ${itemCount} items`);
  }

  return jsonResponse({
    success: true,
    user: user.full_name,
    orders,
    whatsapp_message: lines.join('\n'),
  });
}

async function handlePriceCheck(query: string) {
  // Look up prices in grocery_prices table
  const { data: prices, error } = await supabase
    .from('grocery_prices')
    .select('*')
    .ilike('item_name', `%${query}%`)
    .order('price', { ascending: true })
    .limit(20);

  if (error) return jsonResponse({ error: error.message }, 500);

  if (!prices || prices.length === 0) {
    return jsonResponse({
      success: true,
      query,
      prices: [],
      whatsapp_message: `No price data found for "${query}". Try importing orders first to build price history.`,
    });
  }

  // Group by platform
  const byPlatform = new Map<string, typeof prices>();
  for (const p of prices) {
    const platform = p.platform || 'unknown';
    if (!byPlatform.has(platform)) byPlatform.set(platform, []);
    byPlatform.get(platform)!.push(p);
  }

  const lines: string[] = [`*Prices for "${query}":*`, ''];
  let cheapest = { platform: '', price: Infinity, name: '' };

  for (const [platform, platformPrices] of byPlatform) {
    const best = platformPrices[0];
    const brandStr = best.brand ? ` (${best.brand})` : '';
    const weightStr = best.weight || best.pack_size ? ` ${best.weight || best.pack_size}` : '';
    lines.push(`- ${platform}: Rs.${best.price}${weightStr}${brandStr}`);
    if (best.price < cheapest.price) {
      cheapest = { platform, price: best.price, name: best.item_name };
    }
  }

  if (cheapest.platform) {
    lines.push('');
    lines.push(`Cheapest: ${cheapest.platform} Rs.${cheapest.price}`);
  }

  return jsonResponse({
    success: true,
    query,
    prices,
    cheapest,
    whatsapp_message: lines.join('\n'),
  });
}

// ---------- Route handlers ----------

export async function OPTIONS() {
  return jsonResponse({});
}

export async function GET(request: NextRequest) {
  if (!validateKey(request)) return unauthorized();

  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  const memberName = searchParams.get('member_name') || searchParams.get('profile_id') || '';
  const query = searchParams.get('query') || '';
  const limit = parseInt(searchParams.get('limit') || '5', 10);

  switch (action) {
    case 'grocery-list':
      return handleGroceryList(memberName);
    case 'weekly-plan':
      return handleWeeklyPlan(memberName);
    case 'order-history':
      return handleOrderHistory(memberName, limit);
    case 'price-check':
      return handlePriceCheck(query);
    default:
      return jsonResponse({
        error: 'Unknown action. Available: grocery-list, weekly-plan, order-history, price-check',
      }, 400);
  }
}

export async function POST(request: NextRequest) {
  if (!validateKey(request)) return unauthorized();

  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'import': {
        // Forward to the import API
        const importPayload = {
          platform: body.platform,
          member_name: body.member_name,
          order_type: body.order_type || 'grocery',
          orders: body.orders,
          household_id: body.household_id,
          profile_id: body.profile_id,
        };

        // Call import logic directly (same Supabase instance)
        if (!importPayload.orders || importPayload.orders.length === 0) {
          return jsonResponse({ error: 'No orders to import' }, 400);
        }

        let resolvedProfileId = importPayload.profile_id;
        let resolvedHouseholdId = importPayload.household_id;

        if (!resolvedProfileId && importPayload.member_name) {
          const user = await resolveProfile(importPayload.member_name);
          if (user) {
            resolvedProfileId = user.profile_id;
            resolvedHouseholdId = user.household_id;
          }
        }

        const orderRows = importPayload.orders.map((order: {
          order_date?: string;
          items: unknown[];
          total_amount: number;
          [key: string]: unknown;
        }) => ({
          household_id: resolvedHouseholdId,
          profile_id: resolvedProfileId,
          platform: importPayload.platform,
          order_date: order.order_date || new Date().toISOString(),
          order_type: importPayload.order_type,
          items: order.items,
          total_amount: order.total_amount,
          raw_data: order,
        }));

        const { data, error } = await supabase.from('order_history').insert(orderRows).select('id');

        if (error) {
          return jsonResponse({ error: error.message }, 500);
        }

        // Count unique items
        let uniqueItemCount = 0;
        const seen = new Set<string>();
        for (const order of importPayload.orders) {
          for (const item of (order as { items: { name: string }[] }).items) {
            const key = item.name.toLowerCase().trim();
            if (!seen.has(key)) {
              seen.add(key);
              uniqueItemCount++;
            }
          }
        }

        return jsonResponse({
          success: true,
          imported: data?.length || 0,
          unique_items: uniqueItemCount,
          platform: importPayload.platform,
          member_name: importPayload.member_name,
          whatsapp_message: `Imported ${data?.length || 0} orders with ${uniqueItemCount} unique items from ${importPayload.platform}.`,
        });
      }

      default:
        return jsonResponse({ error: 'Unknown action. Available: import' }, 400);
    }
  } catch (err) {
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
}
