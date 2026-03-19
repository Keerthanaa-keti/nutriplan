import { NextRequest, NextResponse } from 'next/server';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// Proxy endpoint: fetches orders from Swiggy/BigBasket/etc using provided cookies,
// then forwards to the import API
export async function POST(request: NextRequest) {
  try {
    const { platform, cookies, member_name } = await request.json();

    const PLATFORM_CONFIGS: Record<string, { url: string; headers: Record<string, string>; getOrders: (data: any) => any[]; getNextParam: (orders: any[]) => string; orderType: string }> = {
      swiggy: {
        url: 'https://www.swiggy.com/dapi/order/all',
        headers: { '__fetch_req__': 'true', 'Content-Type': 'application/json' },
        getOrders: (data) => data?.data?.orders || [],
        getNextParam: (orders) => orders.length > 0 ? '?order_id=' + orders[orders.length - 1].order_id : '',
        orderType: 'food_delivery',
      },
    };

    const config = PLATFORM_CONFIGS[platform];
    if (!config) {
      return NextResponse.json({ error: 'Unsupported platform' }, { status: 400, headers: corsHeaders });
    }

    // Fetch all pages
    const allOrders: any[] = [];
    let nextParam = '';
    let page = 0;

    while (page < 50) {
      const res = await fetch(config.url + nextParam, {
        headers: { ...config.headers, Cookie: cookies },
      });

      if (!res.ok) break;
      const data = await res.json();
      const orders = config.getOrders(data);
      if (orders.length === 0) break;

      allOrders.push(...orders);
      nextParam = config.getNextParam(orders);
      page++;
      await new Promise(r => setTimeout(r, 300));
    }

    // Normalize
    const normalized = allOrders.map((o: any) => ({
      platform_order_id: o.order_id?.toString(),
      restaurant_name: o.restaurant_name || '',
      order_date: o.order_time,
      total_amount: parseFloat(o.order_total || 0),
      items: (o.order_items || o.items || []).map((i: any) => ({
        name: i.name || i.item_name || '',
        quantity: parseInt(i.quantity) || 1,
        price: parseFloat(i.total || i.price || i.final_price || 0),
        is_veg: i.is_veg === 1 || i.is_veg === '1' || i.is_veg === true,
        category: i.category || '',
      })),
    }));

    // Forward to import endpoint
    const importRes = await fetch(new URL('/api/import', request.url).toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        platform,
        member_name,
        order_type: config.orderType,
        orders: normalized,
      }),
    });

    const result = await importRes.json();
    return NextResponse.json({ ...result, totalFetched: allOrders.length, pages: page }, { headers: corsHeaders });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}
