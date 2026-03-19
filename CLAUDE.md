# NutriPlan - Nutrition Planning for Families

## Product Vision
A family-first nutrition planning platform that helps couples and families eat healthier together. The app imports existing food and grocery data from delivery apps, understands each person's eating patterns, creates personalized meal plans, and manages grocery shopping with price comparison.

## Core Use Case: Keti & Kishore (Bangalore, Kudlu Gate)

### Family Members
- **Keti (Keerthanaa):** 60kg, eggitarian, 1400 kcal target, 60-90g protein (1-1.5x body weight)
- **Kishore:** 75kg, non-veg (chicken + eggs), 1800 kcal target, 75-112g protein (1-1.5x body weight)

### Their Meal Patterns
- **Keti Breakfast:** Egg omelette (2 eggs), or overnight oats (backup)
- **Keti Lunch:** Rice/millet + daal + sabji (veg), likes sprouts, paneer, millets
- **Keti Dinner:** Light - pomegranate + yogurt + peanut butter
- **Keti Snacks:** Nuts, fruits, whey protein, sprouts
- **Kishore:** Same base meals but with chicken, larger portions, 3 eggs for breakfast
- **Sunday:** DIY fun cook day together

### Their Grocery Sources
- Location: Kudlu Gate, Bangalore
- Preferred brands: Akshayakalpa (dairy), Pintola (PB), The Whole Truth (whey), Farm Connect (paneer), ID (dosa batter)
- Platforms: BigBasket, Blinkit, Zepto, Swiggy Instamart, FirstClub, DMart

## Product Architecture

### Family-First Design
- One household = one family. Each family member has their own profile, targets, and diet type
- **Single family view** on dashboard - shows everyone's targets, aggregate grocery needs
- **Individual import** - each person connects their own Swiggy/Zomato/grocery app accounts
- **Pattern detection** - if accounts are shared, AI identifies distinct patterns per person
- **Aggregated ordering** - weekly grocery list combines all family members' needs into one order

### Home-Cook Scale (Core Feature)
- Dashboard has a visual scale/slider: **Outside Food ← → Home Cooked**
- Recommendation: 80% home cooked, 20% outside food
- When slider moves toward home-cooked:
  - Plan focuses on groceries and cooking
  - Asks "What does your family cook with these ingredients?"
  - Plans future weeks' groceries according to each person's macros
  - Suggests recipes based on family's past cooking history
- When slider moves toward outside:
  - Shows healthier restaurant options
  - Tracks spending on food delivery

### Master Food List
- Family maintains a master list of ALL items they use (from past orders + manually added)
- Weekly meal plan picks from this master list
- Each item has nutrition data, preferred brand, usual source (which app), price history
- Items tagged: home-staple, occasional, seasonal

### Restaurant Food Analysis
When importing food delivery orders (Swiggy/Zomato), each restaurant/dish is analyzed and rated:
- **Healthy Score** (1-10): Based on estimated nutrition, cooking method, ingredients
- **Ultra-Processed Flag**: Identifies highly processed items (maida, refined oil, excess sugar)
- **Satiety Score**: How filling vs calorie-dense (protein+fiber vs empty carbs)
- **Most Ordered**: Frequency tracking per person
- **Cost per Calorie**: Value analysis

### Cheat Meal Intelligence
When a family member wants to indulge:
- App shows their **favorite foods** from order history
- Sorted by: most ordered, highest rated, best current offers
- Compares prices across **Swiggy vs Zomato vs EatSure** etc for the same dish
- Shows nutrition impact: "This butter chicken adds 650 cal, you have 400 cal budget left"
- Suggests **smarter cheats**: similar taste, fewer calories

### Data Import Strategy
Two approaches for importing order history:

#### Approach 1: Chrome Extension (Web-only, limited)
- Works for Swiggy food delivery (130 orders imported via `/dapi/order/all`)
- **Known limitations (as of Mar 2026):**
  - Swiggy Instamart: NO web API for order history, mobile-app-only
  - BigBasket: API endpoints changed, `/mapi/v3.1.0/order/past-orders` no longer works
  - Blinkit: `/v2/order/history` returns 404
  - Zepto: Domain changed from zepto.co to zepto.com, old APIs dead

#### Approach 2: ClawdBot WhatsApp Import (Preferred - Phase 2)
- User sends "import my orders" to ClawdBot on WhatsApp
- ClawdBot uses **Playwright headless browser** on server to:
  1. Open mobile web version of each platform
  2. Enter user's phone number
  3. User forwards OTP to ClawdBot via WhatsApp
  4. Bot enters OTP, logs in, scrapes all order history
  5. Imports into NutriPlan Supabase
- **Advantages:** Works with mobile-only APIs (Instamart!), no extension needed, natural UX

### Core Workflow: Notion-Style Master Table → Weekly Planning
This is the heart of NutriPlan, modeled after Keti's existing Notion workflow:

1. **Master Food Table** (built from imported orders + manual additions)
   - Every food item the family buys/orders
   - Per item: name, brand, category, macros (protein/carbs/fat/calories), price, platform, shelf life
   - Tags: home-staple, occasional, seasonal, subscription-worthy
   - Preferred platform per item (cheapest or fastest)

2. **Weekly Meal Plan** (picks from Master Table)
   - Per person per day: breakfast, lunch, dinner, snacks
   - Auto-calculates daily macros vs targets
   - Shows cost breakdown per day/week
   - 80/20 home-cook vs outside-food split

3. **Monday Grocery Planning**
   - Auto-generates grocery list from next week's meal plan
   - Compares prices across BigBasket, Blinkit, Zepto, Swiggy Instamart
   - Suggests optimal platform per item (cheapest) or per order (fewest deliveries)
   - Groups by: dairy (Mon+Thu), produce (Mon+Thu), pantry staples (monthly)
   - Identifies subscription candidates: items ordered every week at same qty

4. **Smart Suggestions**
   - Subscription recommendations: "You buy Akshayakalpa milk every week → subscribe on BigBasket, save 5%"
   - Refill reminders: "Pintola PB lasts ~3 weeks, time to reorder"
   - Budget alerts: "This week's grocery is ₹2400 vs usual ₹1800 — paneer biryani ingredients are expensive"
   - Macro gaps: "Keti is 20g short on protein this week — add 100g paneer or 2 eggs to Wednesday"

### Two User Types for Onboarding
1. **New couples** - each person has separate app accounts, we aggregate
2. **Shared accounts** - one login used by both, we use AI to detect individual patterns (ask user to confirm)

### Grocery Planning Intelligence
- Auto-generate grocery list from weekly meal plan
- Groups by category (dairy, grains, produce, protein)
- Restock scheduler - knows shelf life, suggests restock day
- Tracks pantry - what's at home vs what to buy
- Compares prices across BigBasket, Blinkit, Zepto, Swiggy Instamart, FirstClub, DMart
- Suggests optimal order day (freshness vs price vs delivery)

## Tech Stack
- **Frontend:** Next.js 16 + TypeScript + Tailwind CSS + shadcn/ui
- **Backend:** Supabase (PostgreSQL + Auth + Realtime + RLS)
- **Extension:** Chrome Manifest V3 + TypeScript
- **Price Scraping:** Playwright (Phase 2)
- **Charts:** Recharts
- **Deploy:** Vercel

## Database Tables
- `profiles` - User profiles with nutrition targets
- `households` - Family units with invite codes
- `household_members` - Links profiles to households
- `food_items` - Master nutrition database (116+ Indian foods seeded)
- `meal_plans` + `meal_plan_items` - Weekly per-person meal plans
- `grocery_lists` + `grocery_items` - Shopping lists from meal plans
- `grocery_prices` - Price tracking across platforms
- `pantry_items` - What's at home
- `order_history` - Imported from food/grocery apps
- `restaurant_items` - Analyzed restaurant dishes with health scores

## Phases
- **Phase 1 (DONE):** Core meal planner + food database + grocery list + pantry + auth + onboarding
- **Phase 2 (DONE):** Chrome extension + Swiggy food import (130 orders) + family dashboard + home-cook scale + import page UX
- **Phase 2.5 (NEXT):** ClawdBot WhatsApp import + Master Table from orders + weekly macro planning + Monday grocery flow
- **Phase 3:** Price comparison across platforms + subscription suggestions + refill reminders + budget tracking
- **Phase 4:** Apple Health integration + auto-ordering + DIY seasonal recipes + smart restock

## Notion Integration
- Keti has existing nutrition data in Notion (page ID: 61bfd0e7-63bf-4396-b35f-3c3df5d8a44f)
- Notion API key available for import
- Existing databases: Main data, Week plans (Kishore + Keti), Week-Egg+Paneer
