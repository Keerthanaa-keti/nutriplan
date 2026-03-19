import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface ImportedOrder {
  platform_order_id: string;
  restaurant_name: string;
  order_date: string;
  total_amount: number;
  items: {
    name: string;
    quantity: number;
    price: number;
    is_veg?: boolean;
    category?: string;
    brand?: string;
    weight?: string;
  }[];
}

interface ImportPayload {
  platform: string;
  member_name: string;
  order_type: 'food_delivery' | 'grocery';
  orders: ImportedOrder[];
  household_id?: string;
  profile_id?: string;
}

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
    const body: ImportPayload = await request.json();
    const { platform, member_name, order_type, orders, household_id, profile_id } = body;

    if (!orders || orders.length === 0) {
      return jsonResponse({ error: 'No orders to import' }, 400);
    }

    // Find profile by name if no profile_id provided
    let resolvedProfileId = profile_id;
    let resolvedHouseholdId = household_id;

    if (!resolvedProfileId && member_name) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id')
        .ilike('full_name', `%${member_name}%`)
        .limit(1);
      if (profiles && profiles.length > 0) {
        resolvedProfileId = profiles[0].id;
      }
    }

    if (resolvedProfileId && !resolvedHouseholdId) {
      const { data: membership } = await supabase
        .from('household_members')
        .select('household_id')
        .eq('profile_id', resolvedProfileId)
        .single();
      if (membership) resolvedHouseholdId = membership.household_id;
    }

    // Insert orders into order_history
    const orderRows = orders.map(order => ({
      household_id: resolvedHouseholdId,
      profile_id: resolvedProfileId,
      platform,
      order_date: order.order_date || new Date().toISOString(),
      order_type,
      items: order.items,
      total_amount: order.total_amount,
      raw_data: order,
    }));

    const { data, error } = await supabase.from('order_history').insert(orderRows).select('id');

    if (error) {
      return jsonResponse({ error: error.message }, 500);
    }

    // Analyze and extract unique food items for the master list
    const uniqueItems = new Map<string, { name: string; count: number; total_spent: number; is_veg: boolean; category: string }>();
    for (const order of orders) {
      for (const item of order.items) {
        const key = item.name.toLowerCase().trim();
        const existing = uniqueItems.get(key);
        if (existing) {
          existing.count += item.quantity;
          existing.total_spent += item.price * item.quantity;
        } else {
          uniqueItems.set(key, {
            name: item.name,
            count: item.quantity,
            total_spent: item.price * item.quantity,
            is_veg: item.is_veg ?? true,
            category: item.category || (order_type === 'grocery' ? 'grocery' : 'restaurant'),
          });
        }
      }
    }

    return jsonResponse({
      success: true,
      imported: data?.length || 0,
      unique_items: uniqueItems.size,
      platform,
      member_name,
    });
  } catch (err) {
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
}
