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

**How the weekly plan works:**

The week has a **fixed structure** (protein theme) but **daily variety** within it:

- **Breakfast**: FIXED every day (e.g., omelette 2-3 eggs — this never changes within a week)
- **Lunch**: ROTATING base + protein — the base rotates daily (roti / rice / millet), the daal rotates (moong / toor / masoor), the sabji rotates (any seasonal veg). But the protein source stays fixed for the week.
- **Dinner**: FIXED pattern (light — yogurt, fruits, peanut butter)
- **Snacks**: FIXED (nuts, fruits, whey)

**Example templates (defines the protein theme for the week):**
- 🥚+🧀 **Egg + Paneer Week**: eggs every morning + paneer in lunch sabji + rotating base
- 🥚+🍗 **Egg + Chicken Week**: eggs every morning + chicken in lunch + rotating base
- 🥚+🫘 **Egg + Sprouts Week**: eggs every morning + sprouts/lentils heavy + millets
- 🧀+🫘 **Paneer + Lentils Week**: paneer + heavy daal + millet rotation

**The weekly plan shows:**
- **Per day**: breakfast (fixed) + lunch (base + daal + sabji, rotating) + dinner (fixed) + snacks
- **Daily macros vs targets**: "Keti: 1420/1450 cal, 82/84g protein ✓"
- **Weekly cost**: total grocery spend for this plan
- **Consolidated quantities**: "This week needs: 21 eggs, 700g paneer, 2kg rice, 500g mixed daal, assorted vegetables..."

The user picks a template (or the app suggests the best fit based on targets), adjusts specific days if needed, and confirms.

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

### Restaurant Food Database (Outside Food)
Separate from the grocery master database. Built from imported Swiggy/Zomato orders (130 orders already imported).

Each restaurant dish has:
- **Name** (e.g., "Box Paneer Biryani - Meghana Foods")
- **Cost**: actual price paid
- **Approx macros**: estimated calories, protein, carbs, fat
- **Category**:
  - 🟢 **Healthy**: high protein, balanced macros, real ingredients (e.g., Quinoa Khichdi from EatFit, Ghee Pudi Idli from Rameshwaram Cafe)
  - 🟡 **Healthy + Slight Cheat**: decent macros but higher calories/fat (e.g., Paneer Biryani from Meghana, Hot Sour Tofu Bowl from Toit)
  - 🔴 **Cheat**: indulgent, high cal, low protein-per-cal (e.g., Walnut Brownie from Theobroma, Pizza from Domino's, Ice Cream)
- **Frequency**: how often ordered
- **Platform**: Swiggy / Zomato

When the user wants to order outside food:
1. Browse their restaurant database filtered by category (healthy / slight cheat / cheat)
2. See macros impact: "This adds 450 cal, you have 400 cal budget left today"
3. Pick and order directly from the app

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

## Business Model (Commercialization)

### Product: NutriPlan Bot — WhatsApp-first nutrition & grocery planner for Indian families

### Why WhatsApp
- 500M+ WhatsApp users in India
- Everyone already orders groceries on phone — WhatsApp is where they chat about food
- No app download needed — works on any phone
- Families share WhatsApp groups — natural for household planning

### Revenue Streams
1. **Affiliate commissions** (primary): When users order groceries through NutriPlan's recommended platform, earn 2-5% referral commission from BigBasket/Blinkit/Zepto/Swiggy. Each household spends ₹5,000-15,000/month on groceries → ₹100-750/month per household.
2. **Premium subscription** (₹99-199/month): Free tier gets manual planning + food tracking. Premium gets auto price comparison, cart pre-filling, Monday grocery reminders, macro reports, family sync.
3. **Brand partnerships**: FMCG brands pay for product recommendations in context. "You buy peanut butter weekly → try Pintola at 20% off this week on BigBasket" (native, relevant, not spammy).
4. **Data insights** (future): Anonymized grocery pattern data for FMCG/retail companies — what Indian families actually eat, buy, and spend.

### WhatsApp Business API Setup
- **Current:** Baileys-based (personal WhatsApp, works for dev/testing, NOT for commercial use)
- **For launch:** Register with Meta's WhatsApp Business API via BSP (Business Solution Provider)
  - BSPs: Gupshup, Twilio, MessageBird, Infobip (all have India presence)
  - Requires: Business verification, phone number, privacy policy, use case approval
  - Cost: ₹0.40-0.80 per conversation (first 1,000 free/month)
  - Template messages for proactive sends (grocery reminders, price alerts)
  - Session messages for interactive conversations (free within 24hr window)
- **Bot number:** Dedicated NutriPlan number (not personal)
- **Green tick verification** once established

### Scaling Architecture
- **Multi-tenant Supabase**: Each user/household gets isolated data with RLS
- **Playwright pool**: Queue-based scraping jobs (1 browser per import, shared for price checks)
- **Caching**: Price data cached for 6 hours (platforms don't change prices that often)
- **WhatsApp sessions**: Stateless bot with Supabase session storage (not in-memory)

### Go-to-Market
1. **MVP (now):** Keti & Kishore use it, refine the workflow
2. **Beta:** 10-20 friends/colleagues in Bangalore, all on WhatsApp
3. **Launch:** Instagram/Twitter content → "How I plan my whole week's nutrition + groceries in 2 minutes on WhatsApp"
4. **Growth:** Referral — "Invite your partner to plan together" (family feature is viral)
5. **Monetize:** Turn on affiliate links once volume justifies BSP cost

---

## Phases
- **Phase 1 (DONE):** Auth + onboarding + dashboard + food database (116 items) + grocery list + pantry
- **Phase 2 (DONE):** Swiggy import (130 orders) + family dashboard + home-cook scale + import page
- **Phase 2.5 (NOW):** Master Database per user + Weekly Plan templates + Grocery Days + Restaurant DB
- **Phase 3:** ClawdBot WhatsApp integration + Playwright scrapers + OTP relay + price comparison
- **Phase 4:** WhatsApp Business API registration + affiliate links + premium tier + auto-cart
- **Phase 5:** Scale — multi-city, more platforms, brand partnerships, data insights
