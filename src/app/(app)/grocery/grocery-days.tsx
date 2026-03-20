'use client';

import { useState } from 'react';
import { MasterFoodItem } from '@/types/database';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ShoppingCart, RefreshCw, CalendarDays, Truck } from 'lucide-react';
import { GROCERY_PLATFORMS } from '@/lib/nutrition/constants';

interface GroceryDayItem {
  id: string;
  name: string;
  brand: string | null;
  category: string;
  quantity: number;
  unit: string;
  estimated_cost: number | null;
  platform: string | null;
  shelf_life_days: number | null;
  daily_quantity: number;
}

interface DayOrder {
  day: string;
  date: string;
  items: GroceryDayItem[];
  total_items: number;
  total_cost: number;
}

interface GroceryData {
  monday: DayOrder;
  thursday: DayOrder;
  grand_total: number;
  platform_summary: Array<{ platform: string; items: number; cost: number }>;
  week_start: string;
}

interface GroceryDaysProps {
  items: MasterFoodItem[];
  profileId: string;
  householdId: string;
}

const CATEGORY_ORDER: Record<string, { label: string; order: number }> = {
  egg: { label: 'Protein', order: 1 },
  meat: { label: 'Protein', order: 1 },
  dairy: { label: 'Dairy', order: 2 },
  grain: { label: 'Grains & Dal', order: 3 },
  dal: { label: 'Grains & Dal', order: 3 },
  staple: { label: 'Grains & Dal', order: 3 },
  vegetable: { label: 'Vegetables & Fruits', order: 4 },
  fruit: { label: 'Vegetables & Fruits', order: 4 },
  oil: { label: 'Pantry Staples', order: 5 },
  condiment: { label: 'Pantry Staples', order: 5 },
  spice: { label: 'Pantry Staples', order: 5 },
  nut_seed: { label: 'Pantry Staples', order: 5 },
  protein_supplement: { label: 'Pantry Staples', order: 5 },
  snack: { label: 'Pantry Staples', order: 5 },
  beverage: { label: 'Pantry Staples', order: 5 },
};

function getCategoryGroup(category: string) {
  return CATEGORY_ORDER[category] || { label: 'Other', order: 6 };
}

function getPlatformLabel(value: string | null): string {
  if (!value) return 'Manual';
  const platform = GROCERY_PLATFORMS.find(p => p.value === value);
  return platform?.label || value;
}

function getPlatformColor(value: string | null): string {
  if (!value) return '#888';
  const platform = GROCERY_PLATFORMS.find(p => p.value === value);
  return platform?.color || '#888';
}

function groupByCategory(items: GroceryDayItem[]) {
  const groups = new Map<string, GroceryDayItem[]>();
  for (const item of items) {
    const group = getCategoryGroup(item.category);
    const existing = groups.get(group.label) || [];
    existing.push(item);
    groups.set(group.label, existing);
  }

  return Array.from(groups.entries())
    .sort((a, b) => {
      const orderA = getCategoryGroup(a[1][0].category).order;
      const orderB = getCategoryGroup(b[1][0].category).order;
      return orderA - orderB;
    });
}

function formatCurrency(amount: number | null): string {
  if (amount === null || amount === undefined) return '--';
  return `\u20B9${Math.round(amount)}`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function DayColumn({ order, color, icon }: { order: DayOrder; color: string; icon: string }) {
  const grouped = groupByCategory(order.items);
  const headerBg = color === 'green' ? 'bg-green-600' : 'bg-blue-600';
  const headerText = color === 'green' ? 'text-green-50' : 'text-blue-50';
  const accentBg = color === 'green' ? 'bg-green-50' : 'bg-blue-50';
  const accentText = color === 'green' ? 'text-green-700' : 'text-blue-700';
  const accentBorder = color === 'green' ? 'border-green-200' : 'border-blue-200';

  return (
    <Card className="flex-1 overflow-hidden">
      <CardHeader className={`${headerBg} ${headerText} py-4`}>
        <CardTitle className="flex items-center gap-2 text-lg font-semibold text-white">
          <span>{icon}</span>
          {order.day} - {order.day === 'Monday' ? 'Full Week Order' : 'Fresh Restock'}
          <Badge variant="secondary" className="ml-auto text-xs">
            {formatDate(order.date)}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {order.items.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <Truck className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No items for this delivery</p>
          </div>
        ) : (
          <>
            {grouped.map(([categoryLabel, items], groupIdx) => {
              const categoryCost = items.reduce((sum, i) => sum + (i.estimated_cost || 0), 0);
              return (
                <div key={categoryLabel}>
                  {groupIdx > 0 && <Separator />}
                  <div className={`px-4 py-2 ${accentBg} ${accentText} font-medium text-sm flex justify-between items-center border-b ${accentBorder}`}>
                    <span>{categoryLabel}</span>
                    <span className="text-xs">{formatCurrency(categoryCost)}</span>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {items.map((item) => (
                      <div key={item.id} className="px-4 py-3 flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">{item.name}</div>
                          <div className="flex items-center gap-2 mt-0.5">
                            {item.brand && (
                              <span className="text-xs text-gray-400">{item.brand}</span>
                            )}
                            {item.platform && (
                              <Badge
                                variant="outline"
                                className="text-[10px] px-1.5 py-0"
                                style={{
                                  borderColor: getPlatformColor(item.platform),
                                  color: getPlatformColor(item.platform),
                                }}
                              >
                                {getPlatformLabel(item.platform)}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-sm font-medium">
                            {item.quantity} {item.unit}
                          </div>
                          <div className="text-xs text-gray-400">
                            {formatCurrency(item.estimated_cost)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            <Separator />
            <div className={`px-4 py-3 ${accentBg} flex justify-between items-center font-semibold`}>
              <span className={accentText}>
                {order.total_items} items
              </span>
              <span className={accentText}>
                {formatCurrency(order.total_cost)}
              </span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function GroceryDays({ items, profileId, householdId }: GroceryDaysProps) {
  const [groceryData, setGroceryData] = useState<GroceryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateGroceryDays = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/grocery/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile_id: profileId, household_id: householdId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to generate grocery list');
        return;
      }
      setGroceryData(data);
    } catch {
      setError('Failed to generate grocery list');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarDays className="h-6 w-6" />
            Grocery Days
          </h1>
          <p className="text-gray-500">
            Weekly grocery split across 2 delivery days based on shelf life
          </p>
        </div>
        <Button onClick={generateGroceryDays} disabled={loading || items.length === 0}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          {groceryData ? 'Regenerate' : 'Generate from Master Database'}
        </Button>
      </div>

      {/* Error */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-4 text-red-700 text-sm">{error}</CardContent>
        </Card>
      )}

      {/* Empty state */}
      {!groceryData && !loading && (
        <Card>
          <CardContent className="py-12 text-center">
            <ShoppingCart className="h-12 w-12 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500 mb-2">
              {items.length === 0
                ? 'No active items in your Master Database. Add items with daily quantities first.'
                : 'Click "Generate from Master Database" to create your weekly grocery split.'}
            </p>
            <p className="text-xs text-gray-400">
              {items.length} active items found in your master database
            </p>
          </CardContent>
        </Card>
      )}

      {/* Loading */}
      {loading && (
        <Card>
          <CardContent className="py-12 text-center">
            <RefreshCw className="h-8 w-8 mx-auto text-gray-400 mb-4 animate-spin" />
            <p className="text-gray-500">Generating grocery days...</p>
          </CardContent>
        </Card>
      )}

      {/* Grocery Days View */}
      {groceryData && !loading && (
        <>
          {/* Week label */}
          <p className="text-sm text-gray-500">
            Week of {formatDate(groceryData.week_start)}
          </p>

          {/* Two-column layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <DayColumn order={groceryData.monday} color="green" icon="📦" />
            <DayColumn order={groceryData.thursday} color="blue" icon="🥬" />
          </div>

          {/* Grand total */}
          <Card>
            <CardContent className="py-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="font-semibold text-lg">
                  Weekly grocery: {formatCurrency(groceryData.grand_total)}
                </div>
                <div className="text-sm text-gray-500">
                  Monday {formatCurrency(groceryData.monday.total_cost)} + Thursday {formatCurrency(groceryData.thursday.total_cost)}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Platform summary */}
          {groceryData.platform_summary.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Platform Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3">
                  {groceryData.platform_summary.map((ps) => (
                    <div
                      key={ps.platform}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg border"
                      style={{ borderColor: getPlatformColor(ps.platform) }}
                    >
                      <Badge
                        variant="outline"
                        className="text-xs"
                        style={{
                          borderColor: getPlatformColor(ps.platform),
                          color: getPlatformColor(ps.platform),
                        }}
                      >
                        {getPlatformLabel(ps.platform)}
                      </Badge>
                      <span className="text-sm text-gray-600">
                        {ps.items} items, {formatCurrency(ps.cost)}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-3">
                  Best ordered from: {groceryData.platform_summary
                    .map(ps => `${getPlatformLabel(ps.platform)} (${ps.items} items, ${formatCurrency(ps.cost)})`)
                    .join(' + ')}
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
