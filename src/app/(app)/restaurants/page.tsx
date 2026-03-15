import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Utensils, AlertTriangle, ThumbsUp, TrendingUp } from 'lucide-react';

export default async function RestaurantsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: membership } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('profile_id', user.id)
    .single();

  // Get food delivery orders
  let orders: { items: { name: string; is_veg: boolean; price: number; quantity: number }[]; platform: string; total_amount: number; order_date: string }[] = [];

  if (membership) {
    const { data } = await supabase
      .from('order_history')
      .select('items, platform, total_amount, order_date')
      .eq('household_id', membership.household_id)
      .eq('order_type', 'food_delivery')
      .order('order_date', { ascending: false })
      .limit(100);
    orders = (data || []) as unknown as typeof orders;
  }

  const hasData = orders.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Restaurant Food Analysis</h1>
        <p className="text-gray-500">How healthy is your outside food?</p>
      </div>

      {!hasData ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Utensils className="h-12 w-12 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500 mb-2">No restaurant orders imported yet.</p>
            <p className="text-sm text-gray-400">Use the Chrome extension to import your Swiggy and Zomato orders.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Rating categories explanation */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card>
              <CardContent className="pt-4 text-center">
                <ThumbsUp className="h-5 w-5 mx-auto text-green-600 mb-1" />
                <p className="text-xs font-medium">Healthy Score</p>
                <p className="text-[10px] text-gray-400">Nutrition quality 1-10</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <AlertTriangle className="h-5 w-5 mx-auto text-red-500 mb-1" />
                <p className="text-xs font-medium">Ultra-Processed</p>
                <p className="text-[10px] text-gray-400">Maida, refined oil, excess sugar</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <TrendingUp className="h-5 w-5 mx-auto text-blue-600 mb-1" />
                <p className="text-xs font-medium">Satiety Score</p>
                <p className="text-[10px] text-gray-400">How filling vs calorie-dense</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <Utensils className="h-5 w-5 mx-auto text-orange-600 mb-1" />
                <p className="text-xs font-medium">Most Ordered</p>
                <p className="text-[10px] text-gray-400">Your go-to comfort foods</p>
              </CardContent>
            </Card>
          </div>

          <p className="text-sm text-gray-500">
            Once you import orders via the Chrome extension, we will analyze each restaurant dish for health scores,
            flag ultra-processed items, and help you find healthier alternatives.
          </p>
        </div>
      )}
    </div>
  );
}
