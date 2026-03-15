'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { calculateTargets, getAge } from '@/lib/nutrition/calculator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type { ActivityLevel, DietType, HealthGoal } from '@/types/database';

const STEPS = ['Profile', 'Goals', 'Diet', 'Partner'];

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const supabase = createClient();

  // Step 1: Profile
  const [gender, setGender] = useState<'male' | 'female' | 'other'>('female');
  const [dob, setDob] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');

  // Step 2: Goals
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>('moderate');
  const [healthGoal, setHealthGoal] = useState<HealthGoal>('maintain');

  // Step 3: Diet
  const [dietType, setDietType] = useState<DietType>('egg');
  const [allergies, setAllergies] = useState<string[]>([]);
  const [cheatDay, setCheatDay] = useState('sunday');

  // Step 4: Partner
  const [inviteCode, setInviteCode] = useState('');
  const [householdName, setHouseholdName] = useState('Our Home');

  async function handleComplete() {
    setLoading(true);
    setError('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const age = dob ? getAge(dob) : 25;
      const targets = calculateTargets({
        weight_kg: parseFloat(weightKg) || 60,
        height_cm: parseFloat(heightCm) || 165,
        age,
        gender,
        activity_level: activityLevel,
        health_goal: healthGoal,
      });

      // Update profile
      const { error: profileError } = await supabase.from('profiles').update({
        gender,
        date_of_birth: dob || null,
        height_cm: parseFloat(heightCm) || null,
        weight_kg: parseFloat(weightKg) || null,
        activity_level: activityLevel,
        health_goal: healthGoal,
        diet_type: dietType,
        allergies,
        cheat_day_preference: cheatDay,
        target_calories: targets.calories,
        target_protein_g: targets.protein_g,
        target_carbs_g: targets.carbs_g,
        target_fat_g: targets.fat_g,
        onboarding_complete: true,
      }).eq('id', user.id);

      if (profileError) throw profileError;

      // Create or join household
      if (inviteCode) {
        const { data: household } = await supabase
          .from('households')
          .select('id')
          .eq('invite_code', inviteCode)
          .single();

        if (household) {
          await supabase.from('household_members').insert({
            household_id: household.id,
            profile_id: user.id,
            role: 'member',
          });
        }
      } else {
        const { data: household } = await supabase
          .from('households')
          .insert({ name: householdName, created_by: user.id })
          .select()
          .single();

        if (household) {
          await supabase.from('household_members').insert({
            household_id: household.id,
            profile_id: user.id,
            role: 'owner',
          });
        }
      }

      router.push('/dashboard');
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-orange-50 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Set up your profile</CardTitle>
          <CardDescription>Step {step + 1} of {STEPS.length}: {STEPS[step]}</CardDescription>
          <Progress value={((step + 1) / STEPS.length) * 100} className="mt-2" />
        </CardHeader>
        <CardContent>
          {error && <p className="text-sm text-red-500 bg-red-50 p-3 rounded mb-4">{error}</p>}

          {step === 0 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Gender</Label>
                <div className="flex gap-2">
                  {(['female', 'male', 'other'] as const).map((g) => (
                    <Button key={g} variant={gender === g ? 'default' : 'outline'} size="sm" onClick={() => setGender(g)}>
                      {g.charAt(0).toUpperCase() + g.slice(1)}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="dob">Date of Birth</Label>
                <Input id="dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="height">Height (cm)</Label>
                  <Input id="height" type="number" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} placeholder="165" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="weight">Weight (kg)</Label>
                  <Input id="weight" type="number" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} placeholder="60" />
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Activity Level</Label>
                <div className="grid gap-2">
                  {[
                    { val: 'sedentary', label: 'Sedentary', desc: 'Desk job, little exercise' },
                    { val: 'light', label: 'Lightly Active', desc: '1-3 days exercise/week' },
                    { val: 'moderate', label: 'Moderately Active', desc: '3-5 days exercise/week' },
                    { val: 'active', label: 'Active', desc: '6-7 days exercise/week' },
                    { val: 'very_active', label: 'Very Active', desc: 'Intense daily exercise' },
                  ].map((a) => (
                    <button
                      key={a.val}
                      className={`text-left p-3 rounded-lg border ${activityLevel === a.val ? 'border-green-600 bg-green-50' : 'border-gray-200 hover:bg-gray-50'}`}
                      onClick={() => setActivityLevel(a.val as ActivityLevel)}
                    >
                      <p className="font-medium text-sm">{a.label}</p>
                      <p className="text-xs text-gray-500">{a.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Health Goal</Label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { val: 'lose', label: 'Lose Weight' },
                    { val: 'maintain', label: 'Maintain' },
                    { val: 'gain', label: 'Gain Muscle' },
                    { val: 'recomp', label: 'Body Recomp' },
                  ].map((g) => (
                    <Button key={g.val} variant={healthGoal === g.val ? 'default' : 'outline'} onClick={() => setHealthGoal(g.val as HealthGoal)}>
                      {g.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Diet Type</Label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { val: 'veg', label: 'Vegetarian', icon: '🟢' },
                    { val: 'egg', label: 'Eggitarian', icon: '🟡' },
                    { val: 'non_veg', label: 'Non-Veg', icon: '🔴' },
                    { val: 'vegan', label: 'Vegan', icon: '🌱' },
                  ].map((d) => (
                    <button
                      key={d.val}
                      className={`p-3 rounded-lg border text-left ${dietType === d.val ? 'border-green-600 bg-green-50' : 'border-gray-200 hover:bg-gray-50'}`}
                      onClick={() => setDietType(d.val as DietType)}
                    >
                      <span className="text-lg mr-2">{d.icon}</span>
                      <span className="font-medium text-sm">{d.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Allergies (select any)</Label>
                <div className="flex flex-wrap gap-2">
                  {['dairy', 'gluten', 'nuts', 'soy', 'eggs', 'fish', 'shellfish'].map((a) => (
                    <Button
                      key={a}
                      size="sm"
                      variant={allergies.includes(a) ? 'default' : 'outline'}
                      onClick={() => setAllergies(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a])}
                    >
                      {a}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Cheat Day</Label>
                <div className="flex flex-wrap gap-2">
                  {['none', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((d) => (
                    <Button key={d} size="sm" variant={cheatDay === d ? 'default' : 'outline'} onClick={() => setCheatDay(d)}>
                      {d === 'none' ? 'No cheat day' : d.charAt(0).toUpperCase() + d.slice(1, 3)}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <p className="text-sm text-green-800 mb-1">Your calculated targets</p>
                {weightKg && heightCm && dob ? (() => {
                  const targets = calculateTargets({
                    weight_kg: parseFloat(weightKg),
                    height_cm: parseFloat(heightCm),
                    age: getAge(dob),
                    gender,
                    activity_level: activityLevel,
                    health_goal: healthGoal,
                  });
                  return (
                    <div className="flex justify-center gap-6 text-sm">
                      <div><p className="font-bold text-lg">{targets.calories}</p><p className="text-gray-600">kcal</p></div>
                      <div><p className="font-bold text-lg">{targets.protein_g}g</p><p className="text-gray-600">protein</p></div>
                      <div><p className="font-bold text-lg">{targets.carbs_g}g</p><p className="text-gray-600">carbs</p></div>
                      <div><p className="font-bold text-lg">{targets.fat_g}g</p><p className="text-gray-600">fat</p></div>
                    </div>
                  );
                })() : <p className="text-sm text-gray-500">Fill in profile details to see targets</p>}
              </div>

              <div className="space-y-4">
                <p className="font-medium">Invite your partner</p>
                <p className="text-sm text-gray-500">Create a new household or join your partner&apos;s with their invite code.</p>

                <div className="space-y-2">
                  <Label htmlFor="household">Household Name</Label>
                  <Input id="household" value={householdName} onChange={(e) => setHouseholdName(e.target.value)} placeholder="Our Home" />
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                  <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-gray-500">or join existing</span></div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="invite">Partner&apos;s Invite Code</Label>
                  <Input id="invite" value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} placeholder="Enter code from your partner" />
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-between mt-6">
            <Button variant="outline" onClick={() => setStep(s => s - 1)} disabled={step === 0}>
              Back
            </Button>
            {step < STEPS.length - 1 ? (
              <Button onClick={() => setStep(s => s + 1)}>Next</Button>
            ) : (
              <Button onClick={handleComplete} disabled={loading}>
                {loading ? 'Setting up...' : 'Complete Setup'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
