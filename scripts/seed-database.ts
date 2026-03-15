#!/usr/bin/env npx tsx
/**
 * Seed the food_items database with Indian food data.
 * Usage: npx tsx scripts/seed-database.ts
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL in .env.local
 */

import { createClient } from '@supabase/supabase-js';
import { SEED_FOODS } from './seed-food-data';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function seed() {
  console.log(`Seeding ${SEED_FOODS.length} food items...`);

  // Check if already seeded
  const { count } = await supabase
    .from('food_items')
    .select('*', { count: 'exact', head: true })
    .eq('source', 'seed');

  if (count && count > 0) {
    console.log(`Database already has ${count} seed items. Skipping.`);
    console.log('To re-seed, delete existing seed items first:');
    console.log("  DELETE FROM food_items WHERE source = 'seed';");
    return;
  }

  const items = SEED_FOODS.map((food) => ({
    name: food.name,
    name_local: food.name_local || null,
    category: food.category,
    subcategory: food.subcategory || null,
    serving_size_g: food.serving_size_g,
    serving_unit: food.serving_unit,
    calories_per_serving: food.calories_per_serving,
    protein_g: food.protein_g,
    carbs_g: food.carbs_g,
    fat_g: food.fat_g,
    fiber_g: food.fiber_g || 0,
    is_veg: food.is_veg,
    is_egg: food.is_egg || false,
    is_vegan: food.is_vegan || false,
    preferred_brand: food.preferred_brand || null,
    source: 'seed',
  }));

  // Insert in batches of 50
  for (let i = 0; i < items.length; i += 50) {
    const batch = items.slice(i, i + 50);
    const { error } = await supabase.from('food_items').insert(batch);
    if (error) {
      console.error(`Error inserting batch ${i / 50 + 1}:`, error.message);
    } else {
      console.log(`Inserted batch ${i / 50 + 1} (${batch.length} items)`);
    }
  }

  console.log('Seeding complete!');
}

seed().catch(console.error);
