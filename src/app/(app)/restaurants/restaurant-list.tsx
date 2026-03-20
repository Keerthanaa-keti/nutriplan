'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Download, Search, Sparkles, Utensils, Loader2, ArrowUpDown } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface RestaurantItem {
  id: string;
  household_id: string;
  name: string;
  restaurant_name: string;
  platform: string;
  estimated_calories: number | null;
  estimated_protein_g: number | null;
  estimated_carbs_g: number | null;
  estimated_fat_g: number | null;
  healthy_score: number | null;
  satiety_score: number | null;
  is_ultra_processed: boolean;
  ultra_processed_reason: string | null;
  times_ordered: number;
  last_ordered_at: string | null;
  total_spent: number;
  avg_price: number | null;
  is_veg: boolean;
  is_favorite: boolean;
  best_platform: string | null;
  best_price: number | null;
  tags: string[];
  health_category: 'healthy' | 'slight_cheat' | 'cheat' | null;
}

type SortOption = 'most_ordered' | 'healthiest' | 'cheapest';
type FilterCategory = 'all' | 'healthy' | 'slight_cheat' | 'cheat';

const HEALTH_BADGE: Record<string, { label: string; className: string; emoji: string }> = {
  healthy: { label: 'Healthy', className: 'bg-green-100 text-green-800 border-green-200', emoji: '🟢' },
  slight_cheat: { label: 'Slight Cheat', className: 'bg-yellow-100 text-yellow-800 border-yellow-200', emoji: '🟡' },
  cheat: { label: 'Cheat', className: 'bg-red-100 text-red-800 border-red-200', emoji: '🔴' },
};

interface Props {
  items: RestaurantItem[];
  householdId: string;
}

export function RestaurantList({ items: initialItems, householdId }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterCategory>('all');
  const [sort, setSort] = useState<SortOption>('most_ordered');
  const [isPopulating, setIsPopulating] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeProgress, setAnalyzeProgress] = useState(0);

  const filtered = useMemo(() => {
    let result = [...initialItems];

    // Filter by health category
    if (filter !== 'all') {
      result = result.filter(item => item.health_category === filter);
    }

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(item =>
        item.name.toLowerCase().includes(q) ||
        item.restaurant_name.toLowerCase().includes(q)
      );
    }

    // Sort
    switch (sort) {
      case 'most_ordered':
        result.sort((a, b) => (b.times_ordered || 0) - (a.times_ordered || 0));
        break;
      case 'healthiest':
        result.sort((a, b) => (b.healthy_score || 0) - (a.healthy_score || 0));
        break;
      case 'cheapest':
        result.sort((a, b) => (a.avg_price || 999) - (b.avg_price || 999));
        break;
    }

    return result;
  }, [initialItems, filter, search, sort]);

  const unanalyzedCount = initialItems.filter(
    item => item.estimated_calories === null
  ).length;

  async function handlePopulate() {
    setIsPopulating(true);
    try {
      const res = await fetch('/api/master-db/populate', { method: 'POST' });
      if (res.ok) router.refresh();
    } catch {
      // silent
    } finally {
      setIsPopulating(false);
    }
  }

  async function handleAnalyze() {
    setIsAnalyzing(true);
    setAnalyzeProgress(0);
    try {
      const unanalyzed = initialItems.filter(i => i.estimated_calories === null);
      for (let i = 0; i < unanalyzed.length; i++) {
        await fetch('/api/ai/analyze-food', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemId: unanalyzed[i].id }),
        });
        setAnalyzeProgress(Math.round(((i + 1) / unanalyzed.length) * 100));
      }
      router.refresh();
    } catch {
      // silent
    } finally {
      setIsAnalyzing(false);
    }
  }

  if (initialItems.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Restaurant Food</h1>
          <p className="text-gray-500">Track and analyze your outside food orders</p>
        </div>
        <Card>
          <CardContent className="py-16 text-center">
            <Utensils className="h-12 w-12 mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-700 mb-2">No restaurant items yet</h3>
            <p className="text-sm text-gray-400 mb-6 max-w-md mx-auto">
              Import your Swiggy and Zomato orders to build your restaurant food database.
              We will analyze each dish for nutrition and health scores.
            </p>
            <Button onClick={handlePopulate} disabled={isPopulating}>
              {isPopulating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
              Populate from Orders
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const filterTabs: { value: FilterCategory; label: string }[] = [
    { value: 'all', label: `All (${initialItems.length})` },
    { value: 'healthy', label: `🟢 Healthy (${initialItems.filter(i => i.health_category === 'healthy').length})` },
    { value: 'slight_cheat', label: `🟡 Slight Cheat (${initialItems.filter(i => i.health_category === 'slight_cheat').length})` },
    { value: 'cheat', label: `🔴 Cheat (${initialItems.filter(i => i.health_category === 'cheat').length})` },
  ];

  const sortOptions: { value: SortOption; label: string }[] = [
    { value: 'most_ordered', label: 'Most Ordered' },
    { value: 'healthiest', label: 'Healthiest' },
    { value: 'cheapest', label: 'Cheapest' },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Restaurant Food</h1>
          <p className="text-gray-500">{initialItems.length} dishes tracked</p>
        </div>
        <div className="flex gap-2">
          {unanalyzedCount > 0 && (
            <Button variant="outline" size="sm" onClick={handleAnalyze} disabled={isAnalyzing}>
              {isAnalyzing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing... {analyzeProgress}%
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Analyze with AI ({unanalyzedCount})
                </>
              )}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handlePopulate} disabled={isPopulating}>
            {isPopulating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
            Populate from Orders
          </Button>
        </div>
      </div>

      {/* Search + Filter + Sort */}
      <div className="space-y-3">
        <div className="flex gap-3 items-center">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search dishes or restaurants..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <div className="flex gap-1.5 items-center">
            <ArrowUpDown className="h-3.5 w-3.5 text-gray-400" />
            {sortOptions.map(opt => (
              <button
                key={opt.value}
                onClick={() => setSort(opt.value)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  sort === opt.value
                    ? 'bg-gray-800 text-white'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {filterTabs.map(tab => (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                filter === tab.value
                  ? 'bg-green-700 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Analyze Progress */}
      {isAnalyzing && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-blue-700 font-medium">Analyzing dishes with AI...</span>
            <span className="text-blue-600">{analyzeProgress}%</span>
          </div>
          <div className="w-full bg-blue-200 rounded-full h-1.5">
            <div
              className="bg-blue-600 h-1.5 rounded-full transition-all"
              style={{ width: `${analyzeProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Card Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map(item => {
          const healthInfo = item.health_category ? HEALTH_BADGE[item.health_category] : null;
          const hasNutrition = item.estimated_calories !== null;

          return (
            <Card key={item.id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-4">
                {/* Top row: name + health badge */}
                <div className="flex items-start justify-between mb-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm leading-tight truncate">{item.name}</p>
                    <p className="text-xs text-gray-400 truncate">{item.restaurant_name}</p>
                  </div>
                  <div className="flex items-center gap-1.5 ml-2 shrink-0">
                    {healthInfo && (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${healthInfo.className}`}>
                        {healthInfo.emoji} {healthInfo.label}
                      </span>
                    )}
                  </div>
                </div>

                {/* Price + Times Ordered */}
                <div className="flex items-center gap-2 mb-3">
                  {item.avg_price && (
                    <Badge variant="outline" className="text-xs font-semibold">
                      ₹{Math.round(item.avg_price)}
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-xs text-gray-500">
                    {item.times_ordered}x ordered
                  </Badge>
                  <Badge variant="outline" className="text-xs text-gray-400">
                    {item.platform}
                  </Badge>
                </div>

                {/* Macro badges */}
                <div className="grid grid-cols-4 gap-1.5 text-center text-xs">
                  <div className="bg-orange-50 rounded p-1.5">
                    <p className="font-bold text-orange-700">
                      {hasNutrition ? item.estimated_calories : '?'}
                    </p>
                    <p className="text-gray-500 text-[10px]">cal</p>
                  </div>
                  <div className="bg-blue-50 rounded p-1.5">
                    <p className="font-bold text-blue-700">
                      {hasNutrition && item.estimated_protein_g !== null ? `${item.estimated_protein_g}g` : '?'}
                    </p>
                    <p className="text-gray-500 text-[10px]">protein</p>
                  </div>
                  <div className="bg-green-50 rounded p-1.5">
                    <p className="font-bold text-green-700">
                      {hasNutrition && item.estimated_carbs_g !== null ? `${item.estimated_carbs_g}g` : '?'}
                    </p>
                    <p className="text-gray-500 text-[10px]">carbs</p>
                  </div>
                  <div className="bg-yellow-50 rounded p-1.5">
                    <p className="font-bold text-yellow-700">
                      {hasNutrition && item.estimated_fat_g !== null ? `${item.estimated_fat_g}g` : '?'}
                    </p>
                    <p className="text-gray-500 text-[10px]">fat</p>
                  </div>
                </div>

                {/* Tags */}
                {item.tags && item.tags.length > 0 && (
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {item.tags.map(tag => (
                      <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <p>No dishes match your search or filters.</p>
        </div>
      )}
    </div>
  );
}
