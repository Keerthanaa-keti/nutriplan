import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PackageOpen } from 'lucide-react';

export default async function PantryPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: membership } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('profile_id', user.id)
    .single();

  if (!membership) return <p>Join a household first</p>;

  const { data: items } = await supabase
    .from('pantry_items')
    .select('*, food_item:food_items(name, category)')
    .eq('household_id', membership.household_id)
    .order('status');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Pantry</h1>
        <p className="text-gray-500">Track what you have at home</p>
      </div>

      {!items || items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <PackageOpen className="h-12 w-12 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">Your pantry is empty. Items will appear here as you shop.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((item) => (
            <Card key={item.id}>
              <CardContent className="pt-4 flex items-center justify-between">
                <div>
                  <p className="font-medium">{(item as unknown as { food_item?: { name: string } }).food_item?.name || item.name_override}</p>
                  <p className="text-xs text-gray-500">
                    {item.quantity_remaining}{item.unit} remaining
                    {item.expiry_date && ` · Expires ${new Date(item.expiry_date).toLocaleDateString('en-IN')}`}
                  </p>
                </div>
                <Badge variant={item.status === 'available' ? 'default' : item.status === 'low' ? 'secondary' : 'destructive'}>
                  {item.status}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
