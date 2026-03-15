import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();

  const { data: membership } = await supabase
    .from('household_members')
    .select('household_id, role, households:households(name, invite_code)')
    .eq('profile_id', user.id)
    .single();

  const household = (membership as unknown as { households: { name: string; invite_code: string } })?.households;

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between">
            <span className="text-gray-500">Name</span>
            <span>{profile?.full_name}</span>
          </div>
          <Separator />
          <div className="flex justify-between">
            <span className="text-gray-500">Email</span>
            <span>{profile?.email}</span>
          </div>
          <Separator />
          <div className="flex justify-between">
            <span className="text-gray-500">Weight</span>
            <span>{profile?.weight_kg} kg</span>
          </div>
          <Separator />
          <div className="flex justify-between">
            <span className="text-gray-500">Diet Type</span>
            <Badge variant="outline">{profile?.diet_type}</Badge>
          </div>
          <Separator />
          <div className="flex justify-between">
            <span className="text-gray-500">Activity Level</span>
            <span className="capitalize">{profile?.activity_level}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Nutrition Targets</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold">{profile?.target_calories}</p>
              <p className="text-xs text-gray-500">kcal</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{profile?.target_protein_g}g</p>
              <p className="text-xs text-gray-500">protein</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{profile?.target_carbs_g}g</p>
              <p className="text-xs text-gray-500">carbs</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{profile?.target_fat_g}g</p>
              <p className="text-xs text-gray-500">fat</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {household && (
        <Card>
          <CardHeader>
            <CardTitle>Household</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-500">Name</span>
              <span>{household.name}</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-gray-500">Role</span>
              <Badge>{membership?.role}</Badge>
            </div>
            <Separator />
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Invite Code</span>
              <code className="bg-gray-100 px-3 py-1 rounded text-sm font-mono">{household.invite_code}</code>
            </div>
            <p className="text-xs text-gray-400">Share this code with your partner so they can join your household.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
