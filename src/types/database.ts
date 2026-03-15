export type DietType = 'veg' | 'egg' | 'non_veg' | 'vegan';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type HealthGoal = 'lose' | 'maintain' | 'gain' | 'recomp';
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack_am' | 'snack_pm';
export type FoodCategory = 'grain' | 'dal' | 'vegetable' | 'fruit' | 'dairy' | 'meat' | 'snack' | 'beverage' | 'condiment' | 'oil' | 'nut_seed' | 'protein_supplement';
export type GroceryPlatform = 'bigbasket' | 'blinkit' | 'zepto' | 'swiggy_instamart' | 'firstclub' | 'dmart' | 'manual';

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  avatar_url?: string;
  date_of_birth?: string;
  gender?: 'male' | 'female' | 'other';
  height_cm?: number;
  weight_kg?: number;
  activity_level?: ActivityLevel;
  diet_type?: DietType;
  allergies: string[];
  health_goal?: HealthGoal;
  target_calories?: number;
  target_protein_g?: number;
  target_carbs_g?: number;
  target_fat_g?: number;
  cheat_day_preference: string;
  onboarding_complete: boolean;
  created_at: string;
  updated_at: string;
}

export interface Household {
  id: string;
  name: string;
  invite_code: string;
  created_by: string;
  created_at: string;
}

export interface HouseholdMember {
  household_id: string;
  profile_id: string;
  role: 'owner' | 'member';
  joined_at: string;
  profile?: Profile;
}

export interface FoodItem {
  id: string;
  name: string;
  name_local?: string;
  category: FoodCategory;
  subcategory?: string;
  serving_size_g: number;
  serving_unit: string;
  calories_per_serving: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sugar_g: number;
  sodium_mg: number;
  is_veg: boolean;
  is_egg: boolean;
  is_vegan: boolean;
  preferred_brand?: string;
  source: string;
  created_at: string;
}

export interface MealPlan {
  id: string;
  household_id: string;
  week_start: string;
  status: 'draft' | 'active' | 'completed';
  notes?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface MealPlanItem {
  id: string;
  meal_plan_id: string;
  profile_id: string;
  day_of_week: number;
  meal_type: MealType;
  food_item_id: string;
  servings: number;
  custom_calories?: number;
  custom_protein_g?: number;
  custom_carbs_g?: number;
  custom_fat_g?: number;
  notes?: string;
  is_cheat: boolean;
  food_item?: FoodItem;
}

export interface GroceryList {
  id: string;
  household_id: string;
  meal_plan_id?: string;
  name: string;
  shop_date?: string;
  status: 'draft' | 'shopping' | 'done';
  total_estimated_cost?: number;
  created_at: string;
  items?: GroceryItem[];
}

export interface GroceryItem {
  id: string;
  grocery_list_id: string;
  food_item_id?: string;
  name_override?: string;
  quantity: number;
  unit: string;
  category?: string;
  is_checked: boolean;
  food_item?: FoodItem;
  prices?: GroceryPrice[];
}

export interface GroceryPrice {
  id: string;
  food_item_id: string;
  platform: GroceryPlatform;
  price: number;
  pack_quantity: number;
  pack_unit: string;
  brand?: string;
  product_name?: string;
  url?: string;
  last_verified_at: string;
}

export interface PantryItem {
  id: string;
  household_id: string;
  food_item_id?: string;
  name_override?: string;
  quantity_remaining?: number;
  unit: string;
  purchased_date?: string;
  expiry_date?: string;
  shelf_life_days?: number;
  status: 'available' | 'low' | 'finished';
  food_item?: FoodItem;
}

export interface NutritionSummary {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
}

export interface DayPlan {
  [mealType: string]: MealPlanItem[];
}

export interface PersonDayPlan {
  profile: Profile;
  meals: DayPlan;
  totals: NutritionSummary;
}

export interface WeekPlanView {
  id: string;
  week_start: string;
  status: string;
  days: {
    [dayIndex: number]: {
      [profileId: string]: PersonDayPlan;
    };
  };
}
