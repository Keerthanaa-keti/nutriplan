import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChefHat, Heart, DollarSign, Flame } from 'lucide-react';

export default async function CheatMealsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Cheat Day Intelligence</h1>
        <p className="text-gray-500">Indulge smart - your favorites with the best deals</p>
      </div>

      {/* Cheat day info */}
      <Card className="bg-purple-50 border-purple-200">
        <CardContent className="pt-4">
          <div className="flex items-center gap-3">
            <ChefHat className="h-8 w-8 text-purple-600" />
            <div>
              <p className="font-medium text-purple-900">
                Your cheat day: <span className="capitalize">{profile?.cheat_day_preference || 'Not set'}</span>
              </p>
              <p className="text-sm text-purple-700">
                Budget: {profile?.target_calories ? Math.round(profile.target_calories * 1.3) : '–'} kcal (30% above target)
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* How it works */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">How Cheat Meals Work</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Heart className="h-4 w-4 text-red-500" />
                <p className="text-sm font-medium">Your Favorites</p>
              </div>
              <p className="text-xs text-gray-500">
                From your order history, we know what you love. Your most-ordered comfort foods,
                sorted by frequency and rating.
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-green-600" />
                <p className="text-sm font-medium">Best Offers</p>
              </div>
              <p className="text-xs text-gray-500">
                Compare prices across Swiggy, Zomato, and EatSure for the same dish.
                We find the best deal so you can cheat without overspending.
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Flame className="h-4 w-4 text-orange-500" />
                <p className="text-sm font-medium">Calorie Impact</p>
              </div>
              <p className="text-xs text-gray-500">
                See how each cheat meal fits your budget. &quot;This butter chicken adds 650 cal,
                you have 400 cal left today.&quot; Plus smarter alternatives.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Placeholder for when data is imported */}
      <Card>
        <CardContent className="py-8 text-center">
          <ChefHat className="h-10 w-10 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">Import your Swiggy & Zomato orders to unlock cheat meal recommendations.</p>
          <p className="text-xs text-gray-400 mt-1">We will show your favorites, find the best deals, and suggest smarter indulgences.</p>
        </CardContent>
      </Card>
    </div>
  );
}
