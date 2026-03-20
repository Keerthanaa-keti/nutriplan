# NutriPlan - Weekly Nutrition & Grocery Planner

## THE CORE CONCEPT (DO NOT DEVIATE)

NutriPlan replaces a manual Notion workflow with an automated system:

```
MASTER DATABASE  →  WEEKLY PLAN  →  GROCERY DAYS  →  AUTO-ORDER
(all food items)    (pick items)    (split into 2     (compare prices,
                                    delivery days)     order cheapest)
```

### Step 1: Master Database
Every user has a **master database** of all food/grocery items they regularly consume.
Each item has:
- **Name** (e.g., "Eggs - Suguna", "Paneer - Farm Connect 200g")
- **Macros per serving**: calories, protein (g), carbs (g), fat (g)
- **Daily quantity**: how many servings per day (e.g., 3 eggs, 100g paneer)
- **Cost per unit**: price on each platform (BigBasket, Blinkit, Zepto, Swiggy Instamart)
- **Cost per day**: unit price × daily quantity
- **Cost per week**: cost per day × 7
- **Category**: protein, dairy, grain, vegetable, fruit, snack, staple
- **Platform**: where they usually buy it (cheapest or preferred)
- **Brand**: preferred brand (Akshayakalpa, Pintola, etc.)

This database is populated from:
1. **Imported orders** (Swiggy, BigBasket, Blinkit, Zepto) — auto-extracted items with prices
2. **Manual additions** — user adds items they buy offline (DMart, local store)
3. **Notion import** — Keti's existing Notion master table

### Step 2: Weekly Plan
Each week, the user creates a **weekly plan** by selecting a plan template or customizing:

**Example templates:**
- 🥚+🧀 **Egg + Paneer Week**: 3 eggs/day + 100g paneer/day + rice + daal + vegetables
- 🥚+🍗 **Egg + Chicken Week**: 3 eggs/day + 200g chicken/day + rice + daal + vegetables
- 🥚+🫘 **Egg + Sprouts Week**: 3 eggs/day + sprouts + millets + vegetables
- 🧀+🫘 **Paneer + Lentils Week**: paneer + moong daal + millets + vegetables

The weekly plan shows:
- **Per person per day**: items, quantities, macros (protein/carbs/fat/calories)
- **Daily totals vs targets**: "Keti: 1420/1450 cal, 82/84g protein ✓"
- **Weekly cost**: total grocery spend for this plan
- **Consolidated quantities**: "This week needs: 21 eggs, 700g paneer, 2kg rice, 500g moong daal..."

The user picks a template (or the app suggests the best fit based on targets), adjusts if needed, and confirms.
Every day within a week has the **same food** — the plan is per-week, not per-day. This keeps grocery simple.

### Step 3: Grocery Days
Once the weekly plan is confirmed, the app auto-generates a **grocery order split across 2 delivery days**:

- **Monday (Day 1)**: Order everything needed for the week
  - Pantry staples (rice, daal, oil) — if running low
  - Protein (eggs, paneer/chicken)
  - Vegetables, fruits
  - Dairy (milk, curd)

- **Thursday (Day 2)**: Restock fresh items only
  - Milk, curd (short shelf life)
  - Fresh vegetables, fruits
  - Any items that ran out

The app knows shelf life of each item and splits accordingly.

### Step 4: Auto-Order with Price Comparison
For each grocery order, the app:
1. **Compares prices** across BigBasket, Blinkit, Zepto, Swiggy Instamart for every item
2. **Suggests the cheapest platform** per item, or the best single platform for the whole order
3. **Identifies subscription candidates**: items ordered every week at same quantity → subscribe and save
4. **Shows total cost**: "This week: ₹1,450 on BigBasket (cheapest) vs ₹1,620 on Blinkit"
5. Future: **Auto-add to cart** on chosen platform via Playwright/extension

---

## Users

### Keti (Keerthanaa)
- 60kg, eggitarian (eggs + veg, no meat)
- Target: 1400-1450 kcal/day, 60-90g protein (1-1.5x body weight)
- Breakfast: 2-3 eggs (omelette/boiled), or overnight oats
- Lunch: Rice/millet + daal + sabji, likes sprouts, paneer, millets
- Dinner: Light — pomegranate + yogurt + peanut butter
- Snacks: Nuts, fruits, whey protein, sprouts
- Brands: Akshayakalpa (dairy), Pintola (PB), The Whole Truth (whey), Farm Connect (paneer), ID (dosa batter)

### Kishore
- 75kg, non-veg (chicken + eggs)
- Target: 1800 kcal/day, 75-112g protein (1-1.5x body weight)
- Same base meals but with chicken, larger portions, 3 eggs for breakfast
- Sunday: DIY fun cook day together

### Location
- Kudlu Gate, Bangalore
- Platforms: BigBasket, Blinkit, Zepto, Swiggy Instamart, FirstClub, DMart

---

## Data Import

### Current: Chrome Extension (Swiggy food delivery only)
- 130 Swiggy food delivery orders imported via `/dapi/order/all`
- Works for restaurant food orders, NOT for grocery/Instamart

### Limitation: Swiggy Instamart
- NO web API for Instamart order history (mobile-app-only)
- Chrome extension cannot access it

### Future: ClawdBot WhatsApp Import (solves Instamart + all platforms)
- Playwright headless browser opens mobile web versions
- User forwards OTP via WhatsApp
- Bot logs in, scrapes all order history (including Instamart)
- Imports into NutriPlan Supabase

### Platform API Status (as of Mar 2026)
- **Swiggy Food**: ✅ Working (`/dapi/order/all`)
- **Swiggy Instamart**: ❌ No web API, needs mobile/Playwright
- **BigBasket**: ❌ API changed, old endpoint dead
- **Blinkit**: ❌ `/v2/order/history` returns 404
- **Zepto**: ❌ Domain changed to zepto.com, old APIs dead

---

## Notion Reference (Keti's Original Workflow)
- Notion page ID: 61bfd0e7-63bf-4396-b35f-3c3df5d8a44f
- Notion API key available for import
- Databases: Main data, Week plans (Kishore + Keti), Week-Egg+Paneer
- **Main data table**: all food items with cost/day, cost/week, macros, daily quantity
- **Week plan table**: pulled rows from main data for that week's plan
- **Monday**: plan grocery, split into 2 delivery days, order

---

## Tech Stack
- **Frontend:** Next.js 16 + TypeScript + Tailwind CSS + shadcn/ui
- **Backend:** Supabase (PostgreSQL + Auth + Realtime + RLS)
- **Extension:** Chrome Manifest V3 (Swiggy import only)
- **Import (future):** ClawdBot + Playwright for all platforms
- **Price Comparison (future):** Playwright scraping
- **Charts:** Recharts
- **Deploy:** Vercel

## Database Tables
- `profiles` — User profiles with nutrition targets
- `households` — Family units with invite codes
- `household_members` — Links profiles to households
- `food_items` — Master nutrition database (116+ Indian foods seeded)
- `master_food_list` — **Per-user master database** (items they actually eat, with cost, macros, daily qty)
- `meal_plans` + `meal_plan_items` — Weekly per-person meal plans
- `grocery_lists` + `grocery_items` — Shopping lists from meal plans
- `grocery_prices` — Price tracking across platforms
- `pantry_items` — What's at home
- `order_history` — Imported from food/grocery apps (130 Swiggy orders)
- `restaurant_items` — Analyzed restaurant dishes with health scores

## Phases
- **Phase 1 (DONE):** Auth + onboarding + dashboard + food database (116 items) + grocery list + pantry
- **Phase 2 (DONE):** Swiggy import (130 orders) + family dashboard + home-cook scale + import page
- **Phase 2.5 (NOW):** Master Database per user + Weekly Plan templates + Grocery Days + price display
- **Phase 3:** ClawdBot import (Instamart, BigBasket, Blinkit, Zepto) + live price comparison + auto-cart
- **Phase 4:** Subscriptions + refill reminders + budget tracking + Apple Health
