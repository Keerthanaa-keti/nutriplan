import { NextRequest, NextResponse } from 'next/server';
import { scrapePrice, PriceResult, ALL_PLATFORMS } from '@/lib/scrapers/price-scraper';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function jsonResponse(data: object, status = 200) {
  return NextResponse.json(data, { status, headers: corsHeaders });
}

export async function OPTIONS() {
  return jsonResponse({});
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query');
    const platformsParam = searchParams.get('platforms');

    if (!query) {
      return jsonResponse({ error: 'query parameter is required' }, 400);
    }

    const platforms = platformsParam
      ? platformsParam.split(',').filter((p) => ALL_PLATFORMS.includes(p))
      : undefined; // undefined = all platforms

    const results: PriceResult[] = await scrapePrice(query, platforms);

    // Find cheapest in-stock result
    const inStock = results.filter((r) => r.in_stock && r.price > 0);
    const cheapest =
      inStock.length > 0
        ? inStock.reduce((min, r) => (r.price < min.price ? r : min))
        : null;

    return jsonResponse({
      success: true,
      query,
      results,
      cheapest,
      platforms_checked: platforms || ALL_PLATFORMS,
    });
  } catch (err) {
    console.error('Price check-single error:', err);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
}
