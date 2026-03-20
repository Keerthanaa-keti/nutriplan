import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';
import {
  CalendarDays, ShoppingCart, Users, Utensils, ChefHat,
  Import, Database, TrendingUp, Star, Clock, ArrowRight,
  Package, IndianRupee
} from 'lucide-react';
import { FamilyOverview } from '@/components/family/family-overview';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();

  const { data: membership } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('profile_id', user.id)
    .single();

  let members: { profile_id: string; role: string; profile: { id: string; full_name: string; target_calories: number; target_protein_g: number; target_carbs_g: number; target_fat_g: number; diet_type: string; weight_kg: number } }[] = [];
  let inviteCode = '';
  let householdName = '';
  const householdId = membership?.household_id || '';

  if (membership) {
    const { data: rawMembers } = await supabase
      .from('household_members')
      .select('profile_id, role')
      .eq('household_id', householdId);

    if (rawMembers && rawMembers.length > 0) {
      const profileIds = rawMembers.map(m => m.profile_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, target_calories, target_protein_g, target_carbs_g, target_fat_g, diet_type, weight_kg')
        .in('id', profileIds);

      members = rawMembers.map(m => ({
        profile_id: m.profile_id,
        role: m.role,
        profile: (profiles || []).find(p => p.id === m.profile_id) as typeof members[0]['profile'],
      })).filter(m => m.profile);
    }

    const { data: household } = await supabase
      .from('households')
      .select('invite_code, name')
      .eq('id', householdId)
      .single();

    inviteCode = household?.invite_code || '';
    householdName = household?.name || 'Our Home';
  }

  // Current week calculation
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const weekStart = monday.toISOString().split('T')[0];

  // --- Fetch all dashboard data in parallel ---
  const [
    currentPlanResult,
    masterFoodResult,
    restaurantItemsResult,
    recentOrdersResult,
    groceryListResult,
  ] = await Promise.all([
    // 1. Current week's meal plan + template
    supabase
      .from('meal_plans')
      .select('id, status, template_id, notes, week_start')
      .eq('household_id', householdId)
      .eq('week_start', weekStart)
      .single(),

    // 2. Master food list stats
    supabase
      .from('master_food_list')
      .select('id, name, cost_per_day, cost_per_week, calories_per_serving, protein_g, daily_quantity, category, is_active')
      .eq('profile_id', user.id)
      .eq('is_active', true),

    // 3. Restaurant items
    supabase
      .from('restaurant_items')
      .select('id, name, restaurant_name, health_category, times_ordered, avg_price')
      .eq('household_id', householdId),

    // 4. Recent orders (last 3)
    supabase
      .from('order_history')
      .select('id, platform, order_date, order_type, items, total_amount')
      .eq('profile_id', user.id)
      .order('order_date', { ascending: false })
      .limit(3),

    // 5. Grocery lists for current week
    supabase
      .from('grocery_lists')
      .select('id, name, shop_date, status, total_estimated_cost')
      .eq('household_id', householdId)
      .order('shop_date', { ascending: true }),
  ]);

  const currentPlan = currentPlanResult.data;
  const masterFoodItems = masterFoodResult.data || [];
  const restaurantItems = restaurantItemsResult.data || [];
  const recentOrders = recentOrdersResult.data || [];
  const groceryLists = groceryListResult.data || [];

  // Fetch template info if plan has one
  let templateInfo: { name: string; emoji: string | null } | null = null;
  if (currentPlan?.template_id) {
    const { data: template } = await supabase
      .from('weekly_plan_templates')
      .select('name, emoji')
      .eq('id', currentPlan.template_id)
      .single();
    templateInfo = template;
  }

  // --- Compute master DB stats ---
  const masterDbCount = masterFoodItems.length;
  const dailyCost = masterFoodItems.reduce((sum, item) => sum + (Number(item.cost_per_day) || 0), 0);
  const weeklyCost = masterFoodItems.reduce((sum, item) => sum + (Number(item.cost_per_week) || 0), 0);
  const dailyCalories = masterFoodItems.reduce((sum, item) =>
    sum + ((Number(item.calories_per_serving) || 0) * (Number(item.daily_quantity) || 1)), 0);
  const dailyProtein = masterFoodItems.reduce((sum, item) =>
    sum + ((Number(item.protein_g) || 0) * (Number(item.daily_quantity) || 1)), 0);

  // --- Compute restaurant stats ---
  const totalRestaurantDishes = restaurantItems.length;
  const healthyCount = restaurantItems.filter(r => r.health_category === 'healthy').length;
  const slightCheatCount = restaurantItems.filter(r => r.health_category === 'slight_cheat').length;
  const cheatCount = restaurantItems.filter(r => r.health_category === 'cheat').length;
  const uncategorizedCount = totalRestaurantDishes - healthyCount - slightCheatCount - cheatCount;
  const mostOrdered = restaurantItems.length > 0
    ? restaurantItems.reduce((top, r) => (r.times_ordered || 0) > (top.times_ordered || 0) ? r : top, restaurantItems[0])
    : null;

  // --- Compute next grocery day ---
  const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon, ..., 4=Thu
  const isBeforeThursday = dayOfWeek < 4 || (dayOfWeek === 4 && today.getHours() < 12);
  const nextGroceryDay = dayOfWeek === 1 ? 'Today (Monday)' :
    dayOfWeek < 4 || (dayOfWeek === 0) ? 'Thursday' :
    dayOfWeek === 4 ? 'Today (Thursday)' : 'Monday';

  // Find next grocery list
  const todayStr = today.toISOString().split('T')[0];
  const upcomingGrocery = groceryLists.find(g => g.shop_date && g.shop_date >= todayStr);

  return (
    <div className="space-y-6">
      {/* Family Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6" />
            {householdName}
          </h1>
          <p className="text-gray-500">
            {members.length} member{members.length !== 1 ? 's' : ''} · Week of {new Date(weekStart).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/import">
            <Button variant="outline" size="sm">
              <Import className="h-4 w-4 mr-1" />
              Import Data
            </Button>
          </Link>
          <Link href="/meal-plan">
            <Button size="sm">
              <CalendarDays className="h-4 w-4 mr-1" />
              {currentPlan ? 'Meal Plan' : 'Create Plan'}
            </Button>
          </Link>
        </div>
      </div>

      {/* Family Members Overview */}
      <FamilyOverview members={members} inviteCode={inviteCode} />

      {/* Data Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* This Week's Plan */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <div className="p-1.5 bg-green-100 rounded-lg">
                <CalendarDays className="h-4 w-4 text-green-700" />
              </div>
              This Week&apos;s Plan
            </CardTitle>
          </CardHeader>
          <CardContent>
            {currentPlan ? (
              <div className="space-y-3">
                {templateInfo ? (
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{templateInfo.emoji}</span>
                    <span className="font-medium text-sm">{templateInfo.name}</span>
                    <Badge variant="outline" className="ml-auto text-xs capitalize">
                      {currentPlan.status}
                    </Badge>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">Custom Plan</span>
                    <Badge variant="outline" className="text-xs capitalize">
                      {currentPlan.status}
                    </Badge>
                  </div>
                )}

                {currentPlan.notes && (
                  <p className="text-xs text-gray-500">{currentPlan.notes}</p>
                )}

                {masterDbCount > 0 && (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-green-50 rounded-lg p-2 text-center">
                      <p className="font-bold text-green-800">{Math.round(dailyCalories)}</p>
                      <p className="text-gray-500">avg cal/day</p>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-2 text-center">
                      <p className="font-bold text-blue-800">{Math.round(dailyProtein)}g</p>
                      <p className="text-gray-500">avg protein/day</p>
                    </div>
                  </div>
                )}

                <Link href="/meal-plan">
                  <Button variant="outline" size="sm" className="w-full mt-1">
                    View Plan <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-gray-500 mb-3">No plan for this week yet</p>
                <Link href="/meal-plan">
                  <Button size="sm">
                    <CalendarDays className="h-4 w-4 mr-1" />
                    Create Weekly Plan
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Master Database Stats */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <div className="p-1.5 bg-violet-100 rounded-lg">
                <Database className="h-4 w-4 text-violet-700" />
              </div>
              Master Database
            </CardTitle>
          </CardHeader>
          <CardContent>
            {masterDbCount > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Active items</span>
                  <span className="font-bold text-lg">{masterDbCount}</span>
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-violet-50 rounded-lg p-2 text-center">
                    <p className="font-bold text-violet-800 flex items-center justify-center gap-0.5">
                      <IndianRupee className="h-3 w-3" />{Math.round(dailyCost)}
                    </p>
                    <p className="text-gray-500">cost/day</p>
                  </div>
                  <div className="bg-orange-50 rounded-lg p-2 text-center">
                    <p className="font-bold text-orange-800 flex items-center justify-center gap-0.5">
                      <IndianRupee className="h-3 w-3" />{Math.round(weeklyCost).toLocaleString('en-IN')}
                    </p>
                    <p className="text-gray-500">cost/week</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-green-50 rounded-lg p-2 text-center">
                    <p className="font-bold text-green-800">{Math.round(dailyCalories)} kcal</p>
                    <p className="text-gray-500">daily total</p>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-2 text-center">
                    <p className="font-bold text-blue-800">{Math.round(dailyProtein)}g</p>
                    <p className="text-gray-500">daily protein</p>
                  </div>
                </div>
                <Link href="/master-db">
                  <Button variant="outline" size="sm" className="w-full mt-1">
                    View Database <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-gray-500 mb-3">No items in your master database yet</p>
                <Link href="/master-db">
                  <Button size="sm">
                    <Database className="h-4 w-4 mr-1" />
                    Add Items
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Next Grocery Order */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <div className="p-1.5 bg-orange-100 rounded-lg">
                <ShoppingCart className="h-4 w-4 text-orange-700" />
              </div>
              Next Grocery Order
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-gray-400" />
                  <span className="font-medium text-sm">{nextGroceryDay}</span>
                </div>
                <Badge variant="outline" className="text-xs">
                  {dayOfWeek <= 1 ? 'Full restock' : dayOfWeek <= 4 ? 'Fresh refill' : 'Full restock'}
                </Badge>
              </div>

              {upcomingGrocery ? (
                <>
                  <div className="bg-orange-50 rounded-lg p-2 text-center text-xs">
                    <p className="font-bold text-orange-800 flex items-center justify-center gap-0.5">
                      <IndianRupee className="h-3 w-3" />
                      {upcomingGrocery.total_estimated_cost
                        ? Math.round(Number(upcomingGrocery.total_estimated_cost)).toLocaleString('en-IN')
                        : '--'}
                    </p>
                    <p className="text-gray-500">estimated cost</p>
                  </div>
                  <Badge
                    className={
                      upcomingGrocery.status === 'done' ? 'bg-green-100 text-green-800' :
                      upcomingGrocery.status === 'shopping' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }
                  >
                    {upcomingGrocery.status === 'done' ? 'Ordered' :
                     upcomingGrocery.status === 'shopping' ? 'Shopping...' : 'Draft'}
                  </Badge>
                </>
              ) : (
                <div className="text-xs text-gray-500">
                  {weeklyCost > 0 ? (
                    <div className="bg-orange-50 rounded-lg p-2 text-center">
                      <p className="font-bold text-orange-800 flex items-center justify-center gap-0.5">
                        <IndianRupee className="h-3 w-3" />{Math.round(weeklyCost).toLocaleString('en-IN')}
                      </p>
                      <p className="text-gray-500">estimated from master DB</p>
                    </div>
                  ) : (
                    <p>No grocery list created yet for this week</p>
                  )}
                </div>
              )}

              <Link href="/grocery">
                <Button variant="outline" size="sm" className="w-full mt-1">
                  View Grocery <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Restaurant Food Insights */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <div className="p-1.5 bg-red-100 rounded-lg">
                <Utensils className="h-4 w-4 text-red-700" />
              </div>
              Restaurant Food
            </CardTitle>
          </CardHeader>
          <CardContent>
            {totalRestaurantDishes > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Dishes tracked</span>
                  <span className="font-bold text-lg">{totalRestaurantDishes}</span>
                </div>
                <Separator />
                <div className="grid grid-cols-3 gap-1.5 text-xs text-center">
                  <div className="bg-green-50 rounded-lg p-1.5">
                    <p className="font-bold text-green-800">{healthyCount}</p>
                    <p className="text-gray-500">healthy</p>
                  </div>
                  <div className="bg-yellow-50 rounded-lg p-1.5">
                    <p className="font-bold text-yellow-800">{slightCheatCount}</p>
                    <p className="text-gray-500">slight cheat</p>
                  </div>
                  <div className="bg-red-50 rounded-lg p-1.5">
                    <p className="font-bold text-red-800">{cheatCount}</p>
                    <p className="text-gray-500">cheat</p>
                  </div>
                </div>
                {uncategorizedCount > 0 && (
                  <p className="text-[10px] text-gray-400 text-center">{uncategorizedCount} uncategorized</p>
                )}
                {mostOrdered && (
                  <div className="flex items-start gap-2 bg-gray-50 rounded-lg p-2 text-xs">
                    <Star className="h-3.5 w-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium">{mostOrdered.name}</p>
                      <p className="text-gray-500">{mostOrdered.restaurant_name} · {mostOrdered.times_ordered}x ordered</p>
                    </div>
                  </div>
                )}
                <Link href="/restaurants">
                  <Button variant="outline" size="sm" className="w-full mt-1">
                    Browse Restaurants <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-gray-500 mb-3">No restaurant dishes analyzed yet</p>
                <Link href="/restaurants">
                  <Button size="sm">
                    <Utensils className="h-4 w-4 mr-1" />
                    Browse Restaurants
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Swiggy Orders */}
      {recentOrders.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <div className="p-1.5 bg-amber-100 rounded-lg">
                <Package className="h-4 w-4 text-amber-700" />
              </div>
              Recent Orders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {recentOrders.map((order) => {
                const items = Array.isArray(order.items) ? order.items : [];
                const itemNames = items
                  .slice(0, 3)
                  .map((item: { name?: string }) => item.name || 'Unknown')
                  .join(', ');
                const moreCount = items.length > 3 ? items.length - 3 : 0;
                const orderDate = new Date(order.order_date);

                return (
                  <div key={order.id} className="py-2.5 first:pt-0 last:pb-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {order.platform}
                        </Badge>
                        <span className="text-xs text-gray-500">
                          {orderDate.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                      {order.total_amount && (
                        <span className="text-sm font-medium flex items-center gap-0.5">
                          <IndianRupee className="h-3 w-3" />
                          {Math.round(Number(order.total_amount)).toLocaleString('en-IN')}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-600 truncate">
                      {itemNames}{moreCount > 0 ? ` +${moreCount} more` : ''}
                    </p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
