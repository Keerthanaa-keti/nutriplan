'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { createClient } from '@/lib/supabase/client';
import { FOOD_CATEGORIES } from '@/lib/nutrition/constants';

interface GroceryListItem {
  id: string;
  food_item_id: string;
  quantity: number;
  unit: string;
  category: string;
  is_checked: boolean;
  food_item?: { name: string; category: string; serving_unit: string };
}

interface Props {
  list: {
    id: string;
    name: string;
    status: string;
    grocery_items: GroceryListItem[];
  };
}

export function GroceryListView({ list }: Props) {
  const [items, setItems] = useState(list.grocery_items || []);
  const supabase = createClient();

  // Group by category
  const grouped = items.reduce<Record<string, GroceryListItem[]>>((acc, item) => {
    const cat = item.category || 'other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  async function toggleItem(itemId: string, checked: boolean) {
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, is_checked: checked } : i));
    await supabase.from('grocery_items').update({ is_checked: checked }).eq('id', itemId);
  }

  const checkedCount = items.filter(i => i.is_checked).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-medium">{list.name}</h2>
        <Badge variant={list.status === 'done' ? 'default' : 'secondary'}>
          {checkedCount}/{items.length} items
        </Badge>
      </div>

      {Object.entries(grouped).map(([category, categoryItems]) => {
        const catLabel = FOOD_CATEGORIES.find(c => c.value === category)?.label || category;
        return (
          <Card key={category}>
            <CardHeader className="py-3">
              <CardTitle className="text-sm text-gray-600">{catLabel}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                {categoryItems.map((item) => (
                  <label key={item.id} className="flex items-center gap-3 cursor-pointer">
                    <Checkbox
                      checked={item.is_checked}
                      onCheckedChange={(checked) => toggleItem(item.id, !!checked)}
                    />
                    <span className={`flex-1 text-sm ${item.is_checked ? 'line-through text-gray-400' : ''}`}>
                      {item.food_item?.name || 'Unknown item'}
                    </span>
                    <span className="text-xs text-gray-500">
                      {item.quantity}{item.unit}
                    </span>
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
