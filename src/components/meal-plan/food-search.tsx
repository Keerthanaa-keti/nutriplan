'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/client';
import { Search } from 'lucide-react';
import type { FoodItem } from '@/types/database';

export function FoodSearch() {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<FoodItem[]>([]);
  const supabase = createClient();

  useEffect(() => {
    if (!search || search.length < 2) {
      setResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      const { data } = await supabase
        .from('food_items')
        .select('*')
        .textSearch('search_vector', search.split(' ').join(' & '), { type: 'websearch' })
        .limit(20);
      setResults((data as FoodItem[]) || []);
    }, 300);
    return () => clearTimeout(timeout);
  }, [search, supabase]);

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          className="pl-10"
          placeholder="Search foods... (e.g., chicken breast, moong dal, oats)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      {results.length > 0 && (
        <Card className="absolute z-10 w-full mt-1 max-h-80 overflow-y-auto">
          <CardContent className="p-2">
            {results.map((food) => (
              <div key={food.id} className="p-2 rounded hover:bg-gray-50 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{food.name}</p>
                  <p className="text-xs text-gray-500">
                    {food.calories_per_serving} cal · {food.protein_g}g P · {food.carbs_g}g C · {food.fat_g}g F
                    · per {food.serving_size_g}{food.serving_unit}
                  </p>
                </div>
                <Badge variant="outline" className="text-xs">
                  {food.category}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
