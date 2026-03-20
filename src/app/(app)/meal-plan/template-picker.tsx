'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Template {
  id: string;
  name: string;
  emoji: string | null;
  description: string | null;
  protein_theme: string | null;
  diet_type: string | null;
}

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
}

interface Props {
  templates: Template[];
  masterItems: MasterItem[];
  profileId: string;
  weekStart: string;
}

const THEME_COLORS: Record<string, string> = {
  egg_paneer: 'border-amber-300 hover:border-amber-400 hover:bg-amber-50/50',
  egg_chicken: 'border-red-300 hover:border-red-400 hover:bg-red-50/50',
  egg_sprouts: 'border-green-300 hover:border-green-400 hover:bg-green-50/50',
  paneer_lentils: 'border-yellow-300 hover:border-yellow-400 hover:bg-yellow-50/50',
};

const DIET_LABELS: Record<string, { label: string; color: string }> = {
  veg: { label: 'Vegetarian', color: 'bg-green-100 text-green-800' },
  egg: { label: 'Eggitarian', color: 'bg-yellow-100 text-yellow-800' },
  non_veg: { label: 'Non-Veg', color: 'bg-red-100 text-red-800' },
};

function findItem(items: MasterItem[], ...keywords: string[]): MasterItem | null {
  for (const kw of keywords) {
    const found = items.find(i => i.name.toLowerCase().includes(kw.toLowerCase()));
    if (found) return found;
  }
  return null;
}

function estimateDailyMacros(
  items: MasterItem[],
  proteinTheme: string
): { calories: number; protein: number; carbs: number; fat: number; cost: number } {
  let cal = 0, prot = 0, carbs = 0, fat = 0, cost = 0;

  const addItem = (item: MasterItem | null, servings?: number) => {
    if (!item) return;
    const s = servings ?? item.daily_quantity ?? 1;
    cal += (item.calories_per_serving || 0) * s;
    prot += (item.protein_g || 0) * s;
    carbs += (item.carbs_g || 0) * s;
    fat += (item.fat_g || 0) * s;
    cost += item.cost_per_day || 0;
  };

  const eggs = findItem(items, 'egg');
  const rice = findItem(items, 'rice');
  const moong = findItem(items, 'moong');
  const vegetables = findItem(items, 'vegetable', 'mixed veg');
  const paneer = findItem(items, 'paneer');
  const chicken = findItem(items, 'chicken');
  const sprouts = findItem(items, 'sprout');
  const curd = findItem(items, 'curd', 'yogurt');
  const pomegranate = findItem(items, 'pomegranate', 'fruit');
  const peanutButter = findItem(items, 'peanut butter');
  const mixedNuts = findItem(items, 'nuts', 'mixed nuts');
  const whey = findItem(items, 'whey', 'protein powder');
  const banana = findItem(items, 'banana');
  const milk = findItem(items, 'milk');
  const oil = findItem(items, 'oil');

  // Breakfast
  if (proteinTheme !== 'paneer_lentils') addItem(eggs);
  else addItem(paneer, 1);
  addItem(milk);

  // Lunch (average day)
  addItem(rice);
  addItem(moong);
  addItem(vegetables);
  addItem(oil);

  // Lunch protein
  if (proteinTheme === 'egg_paneer' || proteinTheme === 'paneer_lentils') addItem(paneer);
  else if (proteinTheme === 'egg_chicken') addItem(chicken);
  else if (proteinTheme === 'egg_sprouts') addItem(sprouts);

  // Dinner
  addItem(curd);
  addItem(pomegranate);
  addItem(peanutButter);

  // Snacks
  addItem(mixedNuts);
  addItem(whey);
  addItem(banana);

  return {
    calories: Math.round(cal),
    protein: Math.round(prot),
    carbs: Math.round(carbs),
    fat: Math.round(fat),
    cost: Math.round(cost),
  };
}

export function TemplatePicker({ templates, masterItems, profileId, weekStart }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSelectTemplate(templateId: string) {
    setLoading(templateId);
    setError(null);
    try {
      const res = await fetch('/api/weekly-plan/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_id: templateId,
          profile_id: profileId,
          week_start: weekStart,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to generate plan');
        setLoading(null);
        return;
      }

      router.refresh();
    } catch {
      setError('Failed to generate plan. Please try again.');
      setLoading(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <Sparkles className="h-8 w-8 mx-auto text-amber-500 mb-3" />
        <h2 className="text-xl font-semibold">Choose a Plan Template</h2>
        <p className="text-gray-500 text-sm mt-1">
          Pick a protein theme for this week. Your meals will be generated from your master database.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg text-center">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {templates.map(template => {
          const macros = estimateDailyMacros(masterItems, template.protein_theme || '');
          const borderClass = THEME_COLORS[template.protein_theme || ''] || 'border-gray-200 hover:border-gray-300';
          const dietInfo = DIET_LABELS[template.diet_type || 'egg'];
          const isLoading = loading === template.id;

          return (
            <Card
              key={template.id}
              className={`border-2 transition-all cursor-pointer ${borderClass} ${
                isLoading ? 'opacity-70' : ''
              }`}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <span className="text-2xl mr-2">{template.emoji}</span>
                    <span className="text-lg font-semibold">{template.name}</span>
                  </div>
                  <Badge className={`text-xs ${dietInfo.color}`}>
                    {dietInfo.label}
                  </Badge>
                </div>

                <p className="text-sm text-gray-500 mb-4 leading-relaxed">
                  {template.description}
                </p>

                {/* Estimated daily macros */}
                <div className="bg-gray-50 rounded-lg p-3 mb-4">
                  <p className="text-xs font-medium text-gray-400 uppercase mb-2">
                    Estimated Daily Macros
                  </p>
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div>
                      <p className="text-lg font-bold text-orange-600">{macros.calories}</p>
                      <p className="text-[10px] text-gray-400">kcal</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-blue-600">{macros.protein}g</p>
                      <p className="text-[10px] text-gray-400">protein</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-amber-600">{macros.carbs}g</p>
                      <p className="text-[10px] text-gray-400">carbs</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-yellow-600">{macros.fat}g</p>
                      <p className="text-[10px] text-gray-400">fat</p>
                    </div>
                  </div>
                  {macros.cost > 0 && (
                    <p className="text-xs text-green-700 text-center mt-2 font-medium">
                      ~Rs.{macros.cost}/day | ~Rs.{macros.cost * 7}/week
                    </p>
                  )}
                </div>

                <Button
                  className="w-full"
                  onClick={() => handleSelectTemplate(template.id)}
                  disabled={loading !== null}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating Plan...
                    </>
                  ) : (
                    'Use This Plan'
                  )}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {masterItems.length === 0 && (
        <div className="text-center text-sm text-gray-400 mt-4">
          Your master database is empty. Macro estimates will show as 0.
          <br />
          <a href="/master-db" className="text-blue-600 underline">
            Go to Master Database
          </a>{' '}
          to add your food items first.
        </div>
      )}
    </div>
  );
}
