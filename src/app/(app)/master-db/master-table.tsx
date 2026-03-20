'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table, TableBody, TableCell, TableFooter, TableHead,
  TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
  DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Plus, Download, Search, Database, Loader2, FileUp, ShoppingBag } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { FoodCatalog } from './food-catalog';

interface MasterFoodItem {
  id: string;
  profile_id: string;
  household_id: string;
  name: string;
  brand: string | null;
  category: string;
  serving_size_g: number | null;
  serving_unit: string | null;
  calories_per_serving: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  daily_quantity: number | null;
  cost_per_unit: number | null;
  pack_size: number | null;
  pack_unit: string | null;
  cost_per_serving: number | null;
  cost_per_day: number | null;
  cost_per_week: number | null;
  preferred_platform: string | null;
  source: string | null;
  typical_meal: string[];
  is_veg: boolean;
  is_egg: boolean;
  is_active: boolean;
}

const CATEGORIES = [
  { value: 'all', label: 'All' },
  { value: 'grain', label: 'Grains' },
  { value: 'dal', label: 'Dal' },
  { value: 'egg', label: 'Protein' },
  { value: 'dairy', label: 'Dairy' },
  { value: 'vegetable', label: 'Vegetables' },
  { value: 'fruit', label: 'Fruits' },
  { value: 'snack', label: 'Snacks' },
  { value: 'nut_seed', label: 'Nuts & Seeds' },
  { value: 'protein_supplement', label: 'Supplements' },
  { value: 'beverage', label: 'Beverages' },
  { value: 'oil', label: 'Oils' },
  { value: 'condiment', label: 'Condiments' },
  { value: 'staple', label: 'Staples' },
];

const CATEGORY_COLORS: Record<string, string> = {
  grain: 'bg-amber-100 text-amber-800',
  dal: 'bg-yellow-100 text-yellow-800',
  egg: 'bg-red-100 text-red-800',
  meat: 'bg-red-100 text-red-800',
  dairy: 'bg-blue-100 text-blue-800',
  vegetable: 'bg-green-100 text-green-800',
  fruit: 'bg-pink-100 text-pink-800',
  snack: 'bg-purple-100 text-purple-800',
  nut_seed: 'bg-orange-100 text-orange-800',
  protein_supplement: 'bg-indigo-100 text-indigo-800',
  beverage: 'bg-cyan-100 text-cyan-800',
  oil: 'bg-lime-100 text-lime-800',
  condiment: 'bg-teal-100 text-teal-800',
  staple: 'bg-gray-100 text-gray-800',
  spice: 'bg-rose-100 text-rose-800',
};

interface Props {
  items: MasterFoodItem[];
  userId: string;
  householdId: string;
}

const DEFAULT_NOTION_PAGE_ID = '61bfd0e7-63bf-4396-b35f-3c3df5d8a44f';

interface NotionDatabase {
  id: string;
  title: string;
}

export function MasterTable({ items: initialItems, userId, householdId }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [isPopulating, setIsPopulating] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Notion import state
  const [notionOpen, setNotionOpen] = useState(false);
  const [notionPageId, setNotionPageId] = useState(DEFAULT_NOTION_PAGE_ID);
  const [notionDatabases, setNotionDatabases] = useState<NotionDatabase[]>([]);
  const [notionLoading, setNotionLoading] = useState(false);
  const [notionImporting, setNotionImporting] = useState<string | null>(null);
  const [notionError, setNotionError] = useState<string | null>(null);
  const [notionResult, setNotionResult] = useState<{ imported: number; skipped: number; errors: number } | null>(null);
  const [notionStep, setNotionStep] = useState<'page' | 'databases' | 'done'>('page');

  // Form state
  const [form, setForm] = useState({
    name: '',
    brand: '',
    category: 'staple',
    calories_per_serving: '',
    protein_g: '',
    carbs_g: '',
    fat_g: '',
    daily_quantity: '1',
    cost_per_unit: '',
    pack_size: '1',
    serving_size_g: '',
    preferred_platform: '',
  });

  const filtered = useMemo(() => {
    let result = initialItems;
    if (activeCategory !== 'all') {
      result = result.filter(item => item.category === activeCategory);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(item =>
        item.name.toLowerCase().includes(q) ||
        (item.brand && item.brand.toLowerCase().includes(q))
      );
    }
    return result;
  }, [initialItems, activeCategory, search]);

  const totals = useMemo(() => {
    return filtered.reduce(
      (acc, item) => {
        const qty = item.daily_quantity || 0;
        acc.calories += (item.calories_per_serving || 0) * qty;
        acc.protein += (item.protein_g || 0) * qty;
        acc.costDay += item.cost_per_day || 0;
        acc.costWeek += item.cost_per_week || 0;
        return acc;
      },
      { calories: 0, protein: 0, costDay: 0, costWeek: 0 }
    );
  }, [filtered]);

  async function handlePopulate() {
    setIsPopulating(true);
    try {
      const res = await fetch('/api/master-db/populate', { method: 'POST' });
      if (res.ok) {
        router.refresh();
      }
    } catch {
      // silent fail
    } finally {
      setIsPopulating(false);
    }
  }

  async function handleAddItem() {
    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from('master_food_list').insert({
        profile_id: userId,
        household_id: householdId,
        name: form.name,
        brand: form.brand || null,
        category: form.category,
        calories_per_serving: parseFloat(form.calories_per_serving) || null,
        protein_g: parseFloat(form.protein_g) || null,
        carbs_g: parseFloat(form.carbs_g) || null,
        fat_g: parseFloat(form.fat_g) || null,
        daily_quantity: parseFloat(form.daily_quantity) || 1,
        cost_per_unit: parseFloat(form.cost_per_unit) || null,
        pack_size: parseFloat(form.pack_size) || 1,
        serving_size_g: parseFloat(form.serving_size_g) || null,
        preferred_platform: form.preferred_platform || null,
        source: 'manual',
      });
      if (!error) {
        setAddOpen(false);
        setForm({
          name: '', brand: '', category: 'staple',
          calories_per_serving: '', protein_g: '', carbs_g: '', fat_g: '',
          daily_quantity: '1', cost_per_unit: '', pack_size: '1',
          serving_size_g: '', preferred_platform: '',
        });
        router.refresh();
      }
    } catch {
      // silent fail
    } finally {
      setSaving(false);
    }
  }

  async function handleNotionFetchDatabases() {
    setNotionLoading(true);
    setNotionError(null);
    setNotionDatabases([]);
    try {
      const res = await fetch('/api/notion/databases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page_id: notionPageId.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNotionError(data.error || 'Failed to fetch databases');
        return;
      }
      if (data.databases.length === 0) {
        setNotionError('No databases found on this page. Make sure the integration is shared with the page.');
        return;
      }
      setNotionDatabases(data.databases);
      setNotionStep('databases');
    } catch {
      setNotionError('Network error. Please try again.');
    } finally {
      setNotionLoading(false);
    }
  }

  async function handleNotionImport(databaseId: string) {
    setNotionImporting(databaseId);
    setNotionError(null);
    setNotionResult(null);
    try {
      const res = await fetch('/api/notion/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          database_id: databaseId,
          profile_id: userId,
          household_id: householdId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNotionError(data.error || 'Import failed');
        return;
      }
      setNotionResult({
        imported: data.imported || 0,
        skipped: data.skipped || 0,
        errors: data.errors || 0,
      });
      setNotionStep('done');
      router.refresh();
    } catch {
      setNotionError('Network error during import. Please try again.');
    } finally {
      setNotionImporting(null);
    }
  }

  function resetNotionDialog() {
    setNotionStep('page');
    setNotionDatabases([]);
    setNotionError(null);
    setNotionResult(null);
    setNotionImporting(null);
    setNotionPageId(DEFAULT_NOTION_PAGE_ID);
  }

  function renderNotionDialog() {
    return (
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import from Notion</DialogTitle>
          <DialogDescription>
            Import your food items from a Notion database into your master list.
          </DialogDescription>
        </DialogHeader>

        {notionStep === 'page' && (
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="notion-page-id">Notion Page ID</Label>
              <Input
                id="notion-page-id"
                placeholder="e.g., 61bfd0e7-63bf-4396-b35f-3c3df5d8a44f"
                value={notionPageId}
                onChange={e => setNotionPageId(e.target.value)}
                className="mt-1 font-mono text-sm"
              />
              <p className="text-xs text-gray-400 mt-1">
                The page ID from your Notion URL. The integration must be shared with this page.
              </p>
            </div>
            {notionError && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
                {notionError}
              </div>
            )}
            <DialogFooter>
              <Button
                onClick={handleNotionFetchDatabases}
                disabled={notionLoading || !notionPageId.trim()}
              >
                {notionLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                Find Databases
              </Button>
            </DialogFooter>
          </div>
        )}

        {notionStep === 'databases' && (
          <div className="space-y-3 py-2">
            <p className="text-sm text-gray-500">
              Found {notionDatabases.length} database{notionDatabases.length !== 1 ? 's' : ''} on this page.
              Click Import to bring items into your master list.
            </p>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {notionDatabases.map(db => (
                <div
                  key={db.id}
                  className="flex items-center justify-between border rounded-lg px-4 py-3 hover:bg-gray-50"
                >
                  <div>
                    <p className="font-medium text-sm">{db.title}</p>
                    <p className="text-xs text-gray-400 font-mono">{db.id}</p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleNotionImport(db.id)}
                    disabled={notionImporting !== null}
                  >
                    {notionImporting === db.id ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4 mr-1" />
                    )}
                    Import
                  </Button>
                </div>
              ))}
            </div>
            {notionError && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
                {notionError}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => { setNotionStep('page'); setNotionError(null); }}>
                Back
              </Button>
            </DialogFooter>
          </div>
        )}

        {notionStep === 'done' && notionResult && (
          <div className="space-y-4 py-2">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-green-800 font-medium text-sm">Import Complete</p>
              <div className="mt-2 space-y-1 text-sm text-green-700">
                <p>{notionResult.imported} item{notionResult.imported !== 1 ? 's' : ''} imported/updated</p>
                {notionResult.skipped > 0 && (
                  <p>{notionResult.skipped} row{notionResult.skipped !== 1 ? 's' : ''} skipped (empty name)</p>
                )}
                {notionResult.errors > 0 && (
                  <p className="text-red-600">{notionResult.errors} error{notionResult.errors !== 1 ? 's' : ''}</p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setNotionOpen(false); resetNotionDialog(); }}>
                Close
              </Button>
              <Button onClick={() => { setNotionStep('databases'); setNotionResult(null); }}>
                Import Another
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    );
  }

  const existingItemNames = useMemo(() => {
    return initialItems.map(item => item.name);
  }, [initialItems]);

  const formatNum = (n: number | null, decimals = 0) => {
    if (n === null || n === undefined) return '-';
    return decimals > 0 ? n.toFixed(decimals) : Math.round(n).toString();
  };

  if (initialItems.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Master Database</h1>
          <p className="text-gray-500">Your personal food & grocery tracker</p>
        </div>
        <Card>
          <CardContent className="py-16 text-center">
            <Database className="h-12 w-12 mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-700 mb-2">No items yet</h3>
            <p className="text-sm text-gray-400 mb-6 max-w-md mx-auto">
              Get started by importing your order history or adding items manually.
              Your master database tracks everything you eat with macros, costs, and daily quantities.
            </p>
            <div className="flex gap-3 justify-center flex-wrap">
              <Button onClick={handlePopulate} disabled={isPopulating} variant="outline">
                {isPopulating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                Auto-populate from Orders
              </Button>
              <Dialog open={notionOpen} onOpenChange={(open) => { setNotionOpen(open); if (!open) resetNotionDialog(); }}>
                <DialogTrigger render={<Button variant="outline" />}>
                  <FileUp className="h-4 w-4 mr-2" />
                  Import from Notion
                </DialogTrigger>
                {renderNotionDialog()}
              </Dialog>
              <Button onClick={() => setCatalogOpen(true)} variant="default">
                <ShoppingBag className="h-4 w-4 mr-2" />
                Browse Catalog
              </Button>
              <Dialog open={addOpen} onOpenChange={setAddOpen}>
                <DialogTrigger render={<Button variant="outline" />}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </DialogTrigger>
                {renderAddDialog()}
              </Dialog>
            </div>
            <FoodCatalog
              open={catalogOpen}
              onOpenChange={setCatalogOpen}
              userId={userId}
              householdId={householdId}
              existingItemNames={existingItemNames}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  function renderAddDialog() {
    return (
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Food Item</DialogTitle>
          <DialogDescription>Add a new item to your master database.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 py-2">
          <div className="col-span-2">
            <Label htmlFor="name">Name *</Label>
            <Input id="name" placeholder="e.g., Eggs - Suguna" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <Label htmlFor="brand">Brand</Label>
            <Input id="brand" placeholder="e.g., Akshayakalpa" value={form.brand}
              onChange={e => setForm(f => ({ ...f, brand: e.target.value }))} />
          </div>
          <div>
            <Label htmlFor="category">Category</Label>
            <select id="category" value={form.category}
              onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm">
              {CATEGORIES.filter(c => c.value !== 'all').map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="cal">Calories/serving</Label>
            <Input id="cal" type="number" placeholder="0" value={form.calories_per_serving}
              onChange={e => setForm(f => ({ ...f, calories_per_serving: e.target.value }))} />
          </div>
          <div>
            <Label htmlFor="protein">Protein (g)</Label>
            <Input id="protein" type="number" placeholder="0" value={form.protein_g}
              onChange={e => setForm(f => ({ ...f, protein_g: e.target.value }))} />
          </div>
          <div>
            <Label htmlFor="carbs">Carbs (g)</Label>
            <Input id="carbs" type="number" placeholder="0" value={form.carbs_g}
              onChange={e => setForm(f => ({ ...f, carbs_g: e.target.value }))} />
          </div>
          <div>
            <Label htmlFor="fat">Fat (g)</Label>
            <Input id="fat" type="number" placeholder="0" value={form.fat_g}
              onChange={e => setForm(f => ({ ...f, fat_g: e.target.value }))} />
          </div>
          <div>
            <Label htmlFor="qty">Daily Qty (servings)</Label>
            <Input id="qty" type="number" placeholder="1" value={form.daily_quantity}
              onChange={e => setForm(f => ({ ...f, daily_quantity: e.target.value }))} />
          </div>
          <div>
            <Label htmlFor="serving">Serving Size (g)</Label>
            <Input id="serving" type="number" placeholder="100" value={form.serving_size_g}
              onChange={e => setForm(f => ({ ...f, serving_size_g: e.target.value }))} />
          </div>
          <div>
            <Label htmlFor="cost">Cost/pack</Label>
            <Input id="cost" type="number" placeholder="0" value={form.cost_per_unit}
              onChange={e => setForm(f => ({ ...f, cost_per_unit: e.target.value }))} />
          </div>
          <div>
            <Label htmlFor="packsize">Servings/pack</Label>
            <Input id="packsize" type="number" placeholder="1" value={form.pack_size}
              onChange={e => setForm(f => ({ ...f, pack_size: e.target.value }))} />
          </div>
          <div className="col-span-2">
            <Label htmlFor="platform">Platform</Label>
            <Input id="platform" placeholder="e.g., BigBasket, Blinkit, DMart" value={form.preferred_platform}
              onChange={e => setForm(f => ({ ...f, preferred_platform: e.target.value }))} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleAddItem} disabled={saving || !form.name.trim()}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Add Item
          </Button>
        </DialogFooter>
      </DialogContent>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Master Database</h1>
          <p className="text-sm text-gray-500">{initialItems.length} items in your database</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handlePopulate} disabled={isPopulating}>
            {isPopulating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
            <span className="hidden sm:inline">Auto-populate from Orders</span>
            <span className="sm:hidden">Auto-populate</span>
          </Button>
          <Dialog open={notionOpen} onOpenChange={(open) => { setNotionOpen(open); if (!open) resetNotionDialog(); }}>
            <DialogTrigger render={<Button variant="outline" size="sm" />}>
              <FileUp className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Import from Notion</span>
              <span className="sm:hidden">Notion</span>
            </DialogTrigger>
            {renderNotionDialog()}
          </Dialog>
          <Button size="sm" onClick={() => setCatalogOpen(true)}>
            <ShoppingBag className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Browse Catalog</span>
            <span className="sm:hidden">Catalog</span>
          </Button>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger render={<Button variant="outline" size="sm" />}>
              <Plus className="h-4 w-4 mr-2" />
              Add Item
            </DialogTrigger>
            {renderAddDialog()}
          </Dialog>
        </div>
      </div>

      {/* Food Catalog Dialog */}
      <FoodCatalog
        open={catalogOpen}
        onOpenChange={setCatalogOpen}
        userId={userId}
        householdId={householdId}
        existingItemNames={existingItemNames}
      />

      {/* Search + Category Filters */}
      <div className="space-y-3">
        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search items..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {CATEGORIES.map(cat => (
            <button
              key={cat.value}
              onClick={() => setActiveCategory(cat.value)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                activeCategory === cat.value
                  ? 'bg-green-700 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table className="min-w-[800px]">
            <TableHeader>
              <TableRow className="bg-gray-50/80">
                <TableHead className="font-semibold">Name</TableHead>
                <TableHead className="font-semibold">Brand</TableHead>
                <TableHead className="font-semibold">Category</TableHead>
                <TableHead className="font-semibold text-right">Cal</TableHead>
                <TableHead className="font-semibold text-right">Protein</TableHead>
                <TableHead className="font-semibold text-right">Carbs</TableHead>
                <TableHead className="font-semibold text-right">Fat</TableHead>
                <TableHead className="font-semibold text-right">Daily Qty</TableHead>
                <TableHead className="font-semibold text-right">Cost/Day</TableHead>
                <TableHead className="font-semibold text-right">Cost/Week</TableHead>
                <TableHead className="font-semibold">Platform</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(item => (
                <TableRow key={item.id} className="hover:bg-gray-50/50">
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell className="text-gray-500">{item.brand || '-'}</TableCell>
                  <TableCell>
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${CATEGORY_COLORS[item.category] || 'bg-gray-100 text-gray-700'}`}>
                      {item.category.replace('_', ' ')}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatNum(item.calories_per_serving)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNum(item.protein_g, 1)}g</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNum(item.carbs_g, 1)}g</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNum(item.fat_g, 1)}g</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNum(item.daily_quantity, 1)}</TableCell>
                  <TableCell className="text-right tabular-nums text-green-700 font-medium">
                    {item.cost_per_day ? `₹${formatNum(item.cost_per_day, 0)}` : '-'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-green-700 font-medium">
                    {item.cost_per_week ? `₹${formatNum(item.cost_per_week, 0)}` : '-'}
                  </TableCell>
                  <TableCell className="text-gray-500 text-xs">{item.preferred_platform || '-'}</TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-8 text-gray-400">
                    No items match your search.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
            {filtered.length > 0 && (
              <TableFooter>
                <TableRow className="bg-gray-50 font-semibold">
                  <TableCell colSpan={3}>Totals (daily)</TableCell>
                  <TableCell className="text-right tabular-nums text-orange-700">{Math.round(totals.calories)}</TableCell>
                  <TableCell className="text-right tabular-nums text-blue-700">{totals.protein.toFixed(1)}g</TableCell>
                  <TableCell colSpan={3}></TableCell>
                  <TableCell className="text-right tabular-nums text-green-700">₹{Math.round(totals.costDay)}</TableCell>
                  <TableCell className="text-right tabular-nums text-green-700">₹{Math.round(totals.costWeek)}</TableCell>
                  <TableCell></TableCell>
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
