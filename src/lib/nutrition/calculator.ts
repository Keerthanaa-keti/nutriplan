import { ActivityLevel, HealthGoal, NutritionSummary } from '@/types/database';

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export interface CalcInput {
  weight_kg: number;
  height_cm: number;
  age: number;
  gender: 'male' | 'female' | 'other';
  activity_level: ActivityLevel;
  health_goal: HealthGoal;
}

export function calculateBMR(input: CalcInput): number {
  const { weight_kg, height_cm, age, gender } = input;
  // Mifflin-St Jeor
  const base = 10 * weight_kg + 6.25 * height_cm - 5 * age;
  return gender === 'male' ? base + 5 : base - 161;
}

export function calculateTDEE(input: CalcInput): number {
  const bmr = calculateBMR(input);
  return Math.round(bmr * ACTIVITY_MULTIPLIERS[input.activity_level]);
}

export function calculateTargets(input: CalcInput): NutritionSummary {
  const tdee = calculateTDEE(input);

  const calorieAdjustment: Record<HealthGoal, number> = {
    lose: -500,
    maintain: 0,
    gain: 300,
    recomp: -200,
  };

  const calories = Math.round(tdee + calorieAdjustment[input.health_goal]);

  // Protein: 1.2-1.5g per kg body weight based on goal
  const proteinMultiplier = input.health_goal === 'lose' || input.health_goal === 'recomp' ? 1.4 : 1.2;
  const protein_g = Math.round(input.weight_kg * proteinMultiplier);

  // Fat: 25% of calories
  const fat_g = Math.round((calories * 0.25) / 9);

  // Carbs: remaining calories
  const proteinCals = protein_g * 4;
  const fatCals = fat_g * 9;
  const carbs_g = Math.round((calories - proteinCals - fatCals) / 4);

  return {
    calories,
    protein_g,
    carbs_g,
    fat_g,
    fiber_g: Math.round(calories / 1000 * 14), // 14g per 1000 cal
  };
}

export function getAge(dateOfBirth: string): number {
  const today = new Date();
  const birth = new Date(dateOfBirth);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

export function calculateMealNutrition(
  caloriesPerServing: number,
  proteinG: number,
  carbsG: number,
  fatG: number,
  servings: number
): NutritionSummary {
  return {
    calories: Math.round(caloriesPerServing * servings),
    protein_g: Math.round(proteinG * servings * 10) / 10,
    carbs_g: Math.round(carbsG * servings * 10) / 10,
    fat_g: Math.round(fatG * servings * 10) / 10,
    fiber_g: 0,
  };
}
