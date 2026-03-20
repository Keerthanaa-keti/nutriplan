import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { scrapePrice, PriceResult } from '@/lib/scrapers/price-scraper';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
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

const CACHE_HOURS = 6;

interface ItemRequest {
  name: string;
  brand?: string;
  food_item_id?: string;
}

interface ItemComparison {
  item_name: string;
  brand?: string;
  results: PriceResult[];
  cheapest: PriceResult | null;
  cached: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { items } = body as { items: ItemRequest[] };

    if (!items || !Array.isArray(items) || items.length === 0) {
      return jsonResponse(
        { error: 'items array is required (each with a name field)' },
        400,
      );
    }

    if (items.length > 20) {
      return jsonResponse(
        { error: 'Maximum 20 items per request' },
        400,
      );
    }

    const comparisons: ItemComparison[] = [];

    for (const item of items) {
      const query = item.brand
        ? `${item.brand} ${item.name}`
        : item.name;

      // Check cache: look for prices scraped within the last CACHE_HOURS
      let cached = false;
      let results: PriceResult[] = [];

      if (item.food_item_id) {
        const cutoff = new Date(
          Date.now() - CACHE_HOURS * 60 * 60 * 1000,
        ).toISOString();

        const { data: cachedPrices } = await supabase
          .from('grocery_prices')
          .select('*')
          .eq('food_item_id', item.food_item_id)
          .gte('last_verified_at', cutoff);

        if (cachedPrices && cachedPrices.length > 0) {
          cached = true;
          results = cachedPrices.map((row) => ({
            platform: row.platform,
            product_name: row.product_name || item.name,
            brand: row.brand || '',
            price: Number(row.price),
            pack_size: `${row.pack_quantity}${row.pack_unit}`,
            url: row.url || '',
            in_stock: true,
          }));
        }
      }

      // If not cached, scrape fresh
      if (!cached) {
        results = await scrapePrice(query);

        // Store in grocery_prices cache if we have a food_item_id
        if (item.food_item_id && results.length > 0) {
          for (const r of results) {
            // Parse pack_size into quantity and unit
            const packMatch = r.pack_size.match(
              /^([\d.]+)\s*(g|kg|ml|l|unit|pcs|pack)?$/i,
            );
            const packQty = packMatch ? parseFloat(packMatch[1]) : 1;
            const packUnit = packMatch ? (packMatch[2] || 'unit') : 'unit';

            await supabase.from('grocery_prices').upsert(
              {
                food_item_id: item.food_item_id,
                platform: r.platform,
                price: r.price,
                pack_quantity: packQty,
                pack_unit: packUnit.toLowerCase(),
                brand: r.brand || null,
                product_name: r.product_name,
                url: r.url || null,
                last_verified_at: new Date().toISOString(),
              },
              {
                onConflict: 'food_item_id,platform',
                ignoreDuplicates: false,
              },
            );
          }
        }
      }

      // Find cheapest
      const inStockResults = results.filter((r) => r.in_stock && r.price > 0);
      const cheapest =
        inStockResults.length > 0
          ? inStockResults.reduce((min, r) => (r.price < min.price ? r : min))
          : null;

      comparisons.push({
        item_name: item.name,
        brand: item.brand,
        results,
        cheapest,
        cached,
      });
    }

    return jsonResponse({
      success: true,
      comparisons,
      total_items: comparisons.length,
    });
  } catch (err) {
    console.error('Price compare error:', err);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
}
