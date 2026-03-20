'use client';

import { useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Search, Plus, Check, Loader2, X, ShoppingBag } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import {
  FOOD_CATALOG, CATEGORY_LABELS, CATEGORY_EMOJI,
  costPerServing,
  type CatalogItem,
} from '@/data/indian-food-catalog';

const CATEGORY_COLORS: Record<string, string> = {
  egg: 'bg-red-100 text-red-800',
  meat: 'bg-red-100 text-red-800',
  dairy: 'bg-blue-100 text-blue-800',
  grain: 'bg-amber-100 text-amber-800',
  dal: 'bg-yellow-100 text-yellow-800',
  vegetable: 'bg-green-100 text-green-800',
  fruit: 'bg-pink-100 text-pink-800',
  nut_seed: 'bg-orange-100 text-orange-800',
  oil: 'bg-lime-100 text-lime-800',
  protein_supplement: 'bg-indigo-100 text-indigo-800',
  beverage: 'bg-cyan-100 text-cyan-800',
  staple: 'bg-gray-100 text-gray-800',
  condiment: 'bg-teal-100 text-teal-800',
  snack: 'bg-purple-100 text-purple-800',
};

const FILTER_CATEGORIES = [
  'all', 'egg', 'meat', 'dairy', 'grain', 'dal',
  'vegetable', 'fruit', 'nut_seed', 'oil',
  'protein_supplement', 'beverage', 'snack', 'staple', 'condiment',
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  householdId: string;
  existingItemNames: string[];
}

export function FoodCatalog({ open, onOpenChange, userId, householdId, existingItemNames }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [adding, setAdding] = useState(false);
  const [justAdded, setJustAdded] = useState<Set<string>>(new Set());

  const existingSet = useMemo(() => {
    const s = new Set<string>();
    existingItemNames.forEach(n => s.add(n.toLowerCase().trim()));
    return s;
  }, [existingItemNames]);

  const filtered = useMemo(() => {
    let items = FOOD_CATALOG;
    if (activeCategory !== 'all') {
      items = items.filter(item => item.category === activeCategory);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(item =>
        item.name.toLowerCase().includes(q) ||
        item.brand_suggestion.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
      );
    }
    return items;
  }, [activeCategory, search]);

  const isInDB = useCallback((item: CatalogItem) => {
    const name = item.name.toLowerCase().trim();
    return existingSet.has(name) || justAdded.has(name);
  }, [existingSet, justAdded]);

  function toggleSelect(idx: number) {
    const globalIdx = FOOD_CATALOG.indexOf(filtered[idx]);
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(globalIdx)) {
        next.delete(globalIdx);
      } else {
        next.add(globalIdx);
      }
      return next;
    });
  }

  async function addItems(items: CatalogItem[]) {
    setAdding(true);
    try {
      const supabase = createClient();
      const rows = items.map(item => ({
        profile_id: userId,
        household_id: householdId,
        name: item.name,
        brand: item.brand_suggestion,
        category: item.category,
        serving_size_g: item.serving_size_g,
        serving_unit: item.serving_unit,
        calories_per_serving: item.calories_per_serving,
        protein_g: item.protein_g,
        carbs_g: item.carbs_g,
        fat_g: item.fat_g,
        daily_quantity: item.suggested_daily_qty,
        cost_per_unit: item.estimated_cost,
        pack_size: item.pack_servings,
        cost_per_serving: costPerServing(item),
        cost_per_day: Math.round(costPerServing(item) * item.suggested_daily_qty * 100) / 100,
        cost_per_week: Math.round(costPerServing(item) * item.suggested_daily_qty * 7 * 100) / 100,
        preferred_platform: item.platforms[0] || null,
        source: 'catalog',
        is_veg: item.is_veg,
        is_egg: item.is_egg,
        is_active: true,
      }));

      const { error } = await supabase.from('master_food_list').insert(rows);
      if (!error) {
        setJustAdded(prev => {
          const next = new Set(prev);
          items.forEach(i => next.add(i.name.toLowerCase().trim()));
          return next;
        });
        setSelected(new Set());
        router.refresh();
      }
    } catch {
      // silent fail
    } finally {
      setAdding(false);
    }
  }

  async function handleAddSingle(item: CatalogItem) {
    await addItems([item]);
  }

  async function handleBatchAdd() {
    const items = Array.from(selected).map(idx => FOOD_CATALOG[idx]).filter(i => !isInDB(i));
    if (items.length > 0) {
      await addItems(items);
    }
  }

  const selectedNotInDB = Array.from(selected).filter(idx => !isInDB(FOOD_CATALOG[idx]));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5" />
            Food Catalog
          </DialogTitle>
          <DialogDescription>
            Browse 60+ Indian grocery items. Tap + to add to your master database.
          </DialogDescription>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by name, brand, or category..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>

        {/* Category pills */}
        <div className="flex gap-1.5 flex-wrap -mx-1 px-1">
          {FILTER_CATEGORIES.map(cat => {
            // only show categories that have items
            if (cat !== 'all' && !FOOD_CATALOG.some(i => i.category === cat)) return null;
            const emoji = cat !== 'all' ? CATEGORY_EMOJI[cat] || '' : '';
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                  activeCategory === cat
                    ? 'bg-green-700 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {emoji ? `${emoji} ` : ''}{CATEGORY_LABELS[cat] || cat}
              </button>
            );
          })}
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto min-h-0 -mx-4 px-4 pb-2">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
            {filtered.map((item, idx) => {
              const globalIdx = FOOD_CATALOG.indexOf(item);
              const inDB = isInDB(item);
              const isSelected = selected.has(globalIdx);
              const cps = costPerServing(item);

              return (
                <div
                  key={`${item.name}-${idx}`}
                  className={`relative rounded-xl border p-3 transition-all cursor-pointer ${
                    inDB
                      ? 'bg-green-50/60 border-green-200 opacity-70'
                      : isSelected
                        ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-300'
                        : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'
                  }`}
                  onClick={() => !inDB && toggleSelect(idx)}
                >
                  {/* Category emoji */}
                  <div className="flex items-start justify-between mb-1.5">
                    <span className="text-xl leading-none">
                      {CATEGORY_EMOJI[item.category] || '\u{1F37D}\u{FE0F}'}
                    </span>
                    {inDB ? (
                      <span className="flex items-center gap-0.5 text-[10px] font-medium text-green-700 bg-green-100 rounded-full px-1.5 py-0.5">
                        <Check className="h-3 w-3" /> Added
                      </span>
                    ) : isSelected ? (
                      <span className="flex items-center gap-0.5 text-[10px] font-medium text-blue-700 bg-blue-100 rounded-full px-1.5 py-0.5">
                        <Check className="h-3 w-3" /> Selected
                      </span>
                    ) : null}
                  </div>

                  {/* Name */}
                  <h4 className="text-sm font-semibold text-gray-900 leading-tight mb-0.5">
                    {item.name}
                  </h4>
                  <p className="text-[11px] text-gray-500 mb-2 truncate">
                    {item.brand_suggestion}
                  </p>

                  {/* Macros */}
                  <div className="flex gap-1.5 mb-2 flex-wrap">
                    <span className="text-[10px] font-medium bg-orange-50 text-orange-700 rounded px-1.5 py-0.5">
                      {item.calories_per_serving} cal
                    </span>
                    <span className="text-[10px] font-medium bg-blue-50 text-blue-700 rounded px-1.5 py-0.5">
                      {item.protein_g}g P
                    </span>
                  </div>

                  {/* Cost + Add button */}
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-green-700">
                      {'\u20B9'}{cps}/srv
                    </span>
                    {!inDB && (
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          handleAddSingle(item);
                        }}
                        disabled={adding}
                        className="flex items-center justify-center h-6 w-6 rounded-full bg-green-700 text-white hover:bg-green-800 transition-colors disabled:opacity-50"
                        title="Add to master DB"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Category badge */}
                  <div className="mt-1.5">
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-medium ${CATEGORY_COLORS[item.category] || 'bg-gray-100 text-gray-700'}`}>
                      {item.category.replace('_', ' ')}
                    </span>
                    {item.is_veg && (
                      <span className="inline-block ml-1 text-[9px] text-green-600">{'\u25CF'} veg</span>
                    )}
                    {item.is_egg && (
                      <span className="inline-block ml-1 text-[9px] text-amber-600">{'\u25CF'} egg</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <p className="text-sm">No items match your search.</p>
            </div>
          )}
        </div>

        {/* Batch add footer */}
        <DialogFooter>
          <div className="flex items-center justify-between w-full">
            <p className="text-xs text-gray-500">
              {filtered.length} items shown {'\u00B7'} {selectedNotInDB.length} selected
            </p>
            {selectedNotInDB.length > 0 && (
              <Button onClick={handleBatchAdd} disabled={adding} size="sm">
                {adding ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                Add {selectedNotInDB.length} item{selectedNotInDB.length !== 1 ? 's' : ''}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
