import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

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

interface FoodAnalysis {
  name: string;
  estimated_calories: number;
  estimated_protein_g: number;
  estimated_carbs_g: number;
  estimated_fat_g: number;
  health_category: 'healthy' | 'slight_cheat' | 'cheat';
  healthy_score: number;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { household_id, limit = 20 } = body;

    if (!household_id) {
      return jsonResponse({ error: 'household_id is required' }, 400);
    }

    // Fetch restaurant items that haven't been analyzed yet (no calories)
    const { data: items, error: fetchError } = await supabase
      .from('restaurant_items')
      .select('id, name, restaurant_name, is_veg, avg_price')
      .eq('household_id', household_id)
      .is('estimated_calories', null)
      .limit(limit);

    if (fetchError) {
      return jsonResponse({ error: fetchError.message }, 500);
    }

    if (!items || items.length === 0) {
      return jsonResponse({ message: 'No unanalyzed items found', analyzed: 0 });
    }

    // Build the prompt with all dish names
    const dishList = items.map((item, i) =>
      `${i + 1}. "${item.name}" from ${item.restaurant_name} (${item.is_veg ? 'veg' : 'non-veg'}, avg price: ₹${item.avg_price || 'unknown'})`
    ).join('\n');

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: `You are a nutrition expert specializing in Indian restaurant food. Estimate the macros for each dish below. These are from Bangalore restaurants on Swiggy/Zomato.

For each dish, estimate:
- calories (kcal) for a standard single serving
- protein_g, carbs_g, fat_g
- health_category: "healthy" (high protein, balanced, real ingredients), "slight_cheat" (decent but higher cal/fat), or "cheat" (indulgent, high cal, low protein-per-cal)
- healthy_score: 1-10 (10 = very healthy)

Dishes:
${dishList}

Respond ONLY with a JSON array. No explanation. Format:
[
  {
    "index": 1,
    "estimated_calories": 450,
    "estimated_protein_g": 25,
    "estimated_carbs_g": 40,
    "estimated_fat_g": 20,
    "health_category": "healthy",
    "healthy_score": 7
  }
]`
        }
      ],
    });

    // Parse Claude's response
    const responseText = message.content[0].type === 'text' ? message.content[0].text : '';

    // Extract JSON from response (handle potential markdown wrapping)
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return jsonResponse({ error: 'Failed to parse AI response', raw: responseText }, 500);
    }

    const analyses: Array<{
      index: number;
      estimated_calories: number;
      estimated_protein_g: number;
      estimated_carbs_g: number;
      estimated_fat_g: number;
      health_category: string;
      healthy_score: number;
    }> = JSON.parse(jsonMatch[0]);

    // Update each restaurant item with the analysis
    let updated = 0;
    for (const analysis of analyses) {
      const item = items[analysis.index - 1];
      if (!item) continue;

      const { error: updateError } = await supabase
        .from('restaurant_items')
        .update({
          estimated_calories: analysis.estimated_calories,
          estimated_protein_g: analysis.estimated_protein_g,
          estimated_carbs_g: analysis.estimated_carbs_g,
          estimated_fat_g: analysis.estimated_fat_g,
          health_category: analysis.health_category,
          healthy_score: analysis.healthy_score,
          updated_at: new Date().toISOString(),
        })
        .eq('id', item.id);

      if (!updateError) updated++;
    }

    return jsonResponse({
      success: true,
      analyzed: items.length,
      updated,
      model: 'claude-sonnet-4-20250514',
    });
  } catch (err) {
    console.error('Analyze food error:', err);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
}
