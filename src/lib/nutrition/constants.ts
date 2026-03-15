export const MEAL_CALORIE_SPLIT = {
  breakfast: 0.25,
  lunch: 0.30,
  dinner: 0.20,
  snack_am: 0.10,
  snack_pm: 0.15,
};

export const DAYS_OF_WEEK = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
] as const;

export const MEAL_TYPES = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snack_am', label: 'Morning Snack' },
  { value: 'snack_pm', label: 'Evening Snack' },
] as const;

export const FOOD_CATEGORIES = [
  { value: 'grain', label: 'Grains & Cereals' },
  { value: 'dal', label: 'Dals & Legumes' },
  { value: 'vegetable', label: 'Vegetables' },
  { value: 'fruit', label: 'Fruits' },
  { value: 'dairy', label: 'Dairy' },
  { value: 'meat', label: 'Meat & Fish' },
  { value: 'snack', label: 'Snacks' },
  { value: 'beverage', label: 'Beverages' },
  { value: 'condiment', label: 'Condiments & Spices' },
  { value: 'oil', label: 'Oils & Fats' },
  { value: 'nut_seed', label: 'Nuts & Seeds' },
  { value: 'protein_supplement', label: 'Protein Supplements' },
] as const;

export const GROCERY_PLATFORMS = [
  { value: 'bigbasket', label: 'BigBasket', color: '#84c225' },
  { value: 'blinkit', label: 'Blinkit', color: '#f8cb46' },
  { value: 'zepto', label: 'Zepto', color: '#7b2d8e' },
  { value: 'swiggy_instamart', label: 'Swiggy Instamart', color: '#fc8019' },
  { value: 'firstclub', label: 'FirstClub', color: '#1a73e8' },
  { value: 'dmart', label: 'DMart', color: '#007dc5' },
] as const;

export const DIET_TYPES = [
  { value: 'veg', label: 'Vegetarian', emoji: '🟢' },
  { value: 'egg', label: 'Eggitarian', emoji: '🟡' },
  { value: 'non_veg', label: 'Non-Vegetarian', emoji: '🔴' },
  { value: 'vegan', label: 'Vegan', emoji: '🌱' },
] as const;
