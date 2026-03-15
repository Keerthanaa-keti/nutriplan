'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

interface Member {
  profile_id: string;
  role: string;
  profile: {
    id: string;
    full_name: string;
    target_calories: number;
    target_protein_g: number;
    target_carbs_g: number;
    target_fat_g: number;
    diet_type: string;
    weight_kg: number;
  };
}

export function FamilyOverview({ members, inviteCode }: { members: Member[]; inviteCode: string }) {
  const dietColors: Record<string, string> = {
    veg: 'bg-green-100 text-green-800',
    egg: 'bg-yellow-100 text-yellow-800',
    non_veg: 'bg-red-100 text-red-800',
    vegan: 'bg-emerald-100 text-emerald-800',
  };

  const totalCalories = members.reduce((sum, m) => sum + (m.profile?.target_calories || 0), 0);
  const totalProtein = members.reduce((sum, m) => sum + (m.profile?.target_protein_g || 0), 0);

  return (
    <div className="space-y-3">
      {/* Family aggregate */}
      <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
        <CardContent className="pt-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-green-800">Family Daily Targets</p>
            {members.length < 2 && (
              <div className="text-xs text-green-600">
                Invite partner: <code className="bg-green-100 px-2 py-0.5 rounded font-mono">{inviteCode}</code>
              </div>
            )}
          </div>
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-green-800">{totalCalories}</p>
              <p className="text-xs text-green-600">kcal combined</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-700">{totalProtein}g</p>
              <p className="text-xs text-blue-600">protein combined</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-700">{members.length}</p>
              <p className="text-xs text-gray-500">members</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-orange-700">80/20</p>
              <p className="text-xs text-orange-600">home/out target</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Individual members */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {members.map((member) => {
          const p = member.profile;
          if (!p) return null;
          const proteinRange = `${Math.round(p.weight_kg * 1)}–${Math.round(p.weight_kg * 1.5)}g`;

          return (
            <Card key={member.profile_id}>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-bold">
                      {p.full_name?.charAt(0)}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{p.full_name}</p>
                      <p className="text-xs text-gray-400">{p.weight_kg}kg · {member.role}</p>
                    </div>
                  </div>
                  <Badge className={dietColors[p.diet_type] || 'bg-gray-100 text-gray-800'}>
                    {p.diet_type === 'veg' ? 'Veg' : p.diet_type === 'egg' ? 'Egg' : p.diet_type === 'non_veg' ? 'Non-Veg' : 'Vegan'}
                  </Badge>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Calories</span>
                    <span className="font-medium">{p.target_calories} kcal</span>
                  </div>
                  <Progress value={100} className="h-1.5" />

                  <div className="grid grid-cols-3 gap-2 text-center text-xs mt-2">
                    <div className="bg-blue-50 rounded p-1.5">
                      <p className="font-bold text-blue-700">{p.target_protein_g}g</p>
                      <p className="text-gray-500">protein</p>
                      <p className="text-[10px] text-gray-400">({proteinRange})</p>
                    </div>
                    <div className="bg-orange-50 rounded p-1.5">
                      <p className="font-bold text-orange-700">{p.target_carbs_g}g</p>
                      <p className="text-gray-500">carbs</p>
                    </div>
                    <div className="bg-yellow-50 rounded p-1.5">
                      <p className="font-bold text-yellow-700">{p.target_fat_g}g</p>
                      <p className="text-gray-500">fat</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
