# NutriPlan - Weekly Nutrition & Grocery Planner

## THE CORE CONCEPT (DO NOT DEVIATE)

```
MASTER DATABASE  →  WEEKLY PLAN  →  GROCERY DAYS  →  AUTO-ORDER
(all food items)    (pick template)   (Mon + Thu       (compare prices,
                    (rotating meals)   delivery split)   order cheapest)
```

## PRIMARY INTERFACE: WhatsApp Bot (Kiket Fitty)

NutriPlan is a **WhatsApp-first** product. The bot handles both:
- **Tracking** (daily food intake, macros) — already works via Fitty
- **Planning** (weekly plan, grocery list, price comparison, import orders)

The web app (localhost:3000) is a **secondary admin dashboard** for:
- Family view of all data
- Master database table editing (bulk add/edit)
- Visual weekly plan grid
- Restaurant food browsing

### Bot Architecture
```
WhatsApp User
  ↓
Kiket Fitty Bot (single bot, two modes)
  ├── TRACKING MODE: "had 3 eggs and rice" → logs food, shows macros
  └── PLANNING MODE:
      ├── "plan my week" → suggests template, creates plan
      ├── "my grocery list" → Monday/Thursday split with costs
      ├── "compare prices for paneer" → scrapes 4 platforms
      ├── "import my BigBasket orders" → Playwright + OTP relay
      └── "what's cheapest this week?" → platform recommendations
  ↓
Supabase (shared backend)
  ↓
Web Dashboard (family view, admin, data editing)
```

### How Playwright + OTP Works (AWS)
```
1. User: "import my swiggy orders" on WhatsApp
2. Kiket (on AWS) → launches Playwright headless Chromium
3. Playwright opens swiggy.com with mobile User-Agent (pretends to be iPhone)
   — NO mobile emulation needed, just browser with mobile UA + viewport
4. Enters user's phone number → Swiggy sends OTP via SMS
5. User sees OTP on phone → forwards to Kiket: "4523"
6. Kiket enters OTP in Playwright → logged in
7. Scrapes order history (uses network interception for Instamart APIs)
8. Saves to Supabase → replies: "Imported 47 orders!"
9. Session cookies cached → no OTP needed for ~30 days
```

Anti-bot: `playwright-extra` + `stealth` plugin on AWS hides headless fingerprint.

---

## Step 1: Master Database
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

Populated from:
1. **Imported orders** (Swiggy, BigBasket, Blinkit, Zepto) — via Playwright scrapers
2. **Food Catalog** — 62 pre-filled Indian grocery items, tap to add
3. **Manual additions** — user adds items via WhatsApp or web app

### WhatsApp commands:
- "add eggs to my list" → adds to master DB
- "remove paneer" → deactivates item
- "show my items" → lists all active items with macros

## Step 2: Weekly Plan
Each week, the user picks a **protein theme template**:

**Templates:**
- 🥚+🧀 Egg + Paneer Week (eggitarian)
- 🥚+🍗 Egg + Chicken Week (non-veg)
- 🥚+🫘 Egg + Sprouts Week (eggitarian)
- 🧀+🫘 Paneer + Lentils Week (vegetarian)

**Structure (fixed + rotating daily variety):**
- Breakfast: FIXED (omelette every day)
- Lunch: ROTATING base (roti/rice/millet) + rotating dal + rotating sabji + FIXED protein theme
- Dinner: FIXED (curd + fruit + peanut butter)
- Snacks: FIXED (nuts, whey, banana)

### WhatsApp commands:
- "plan my week" → bot suggests template based on targets, user picks
- "what's this week's plan?" → shows current plan summary
- "change to chicken week" → switches template

## Step 3: Grocery Days
Once plan is confirmed, auto-split into **2 delivery days**:

- **Monday**: Full week order (all items)
- **Thursday**: Fresh restock (dairy, vegetables, fruits — short shelf life items)

### WhatsApp commands:
- "my grocery list" → shows Monday + Thursday split with costs
- "what do I order today?" → shows today's list if it's Mon or Thu
- "order from BigBasket" → fills cart via Playwright (user pays manually)

## Step 4: Auto-Order with Price Comparison
For each grocery order:
1. Compare prices across BigBasket, Blinkit, Zepto, Swiggy Instamart
2. Suggest cheapest platform per item or best single platform
3. Identify subscription candidates (weekly repeats)
4. Fill cart on chosen platform via Playwright (user completes payment)

### WhatsApp commands:
- "compare prices for paneer" → scrapes 4 platforms, shows comparison
- "cheapest for this week?" → full grocery list price comparison
- "fill cart on BigBasket" → Playwright adds items to cart

### Cron Jobs (automated):
- **Sunday 8pm**: "This week: 94g protein/day, ₹2,717 groceries. Next week: Egg+Paneer again?"
- **Monday 9am**: "Your Monday grocery list is ready. 15 items, ₹2,455. Want me to fill the cart on BigBasket?"
- **Thursday 9am**: "Thursday restock: 5 items, ₹262. Milk, curd, veggies, fruits."

---

## Restaurant Food Database
Separate from grocery. Built from Swiggy/Zomato order history (140 dishes imported).

Each dish categorized:
- 🟢 **Healthy**: high protein, balanced (Quinoa Khichdi, Green Masappu Dal)
- 🟡 **Slight Cheat**: decent but higher cal (Paneer Biryani, Korean Ramen)
- 🔴 **Cheat**: indulgent (Brownies, Pizza, Ice Cream)

### WhatsApp commands:
- "suggest healthy food" → top healthy dishes from order history
- "cheat meal options" → cheat dishes sorted by price/frequency
- "how many calories in biryani?" → shows macro estimate

---

## Users

### Keti (Keerthanaa)
- 60kg, eggitarian (eggs + veg, no meat)
- Target: 1400-1450 kcal/day, 60-90g protein
- Breakfast: 2-3 eggs, Lunch: rice/roti + dal + sabji + paneer, Dinner: light
- Brands: Akshayakalpa, Pintola, The Whole Truth, Farm Connect, ID

### Kishore
- 75kg, non-veg (chicken + eggs)
- Target: 1800 kcal/day, 75-112g protein
- Same structure but with chicken, larger portions

### Location: Kudlu Gate, Bangalore
Platforms: BigBasket, Blinkit, Zepto, Swiggy Instamart, FirstClub, DMart

---

## Tech Stack
- **Primary:** WhatsApp via ClawdBot/OpenClaw (Kiket Fitty bot)
- **Backend:** Supabase (PostgreSQL + Auth + RLS)
- **Web Dashboard:** Next.js 16 + TypeScript + Tailwind + shadcn/ui
- **Scraping:** Playwright + stealth plugin (runs on AWS)
- **AI:** Anthropic Claude (food analysis, macro estimation)
- **Deploy:** AWS (bot + scrapers), Vercel (web dashboard)

## Business Model
1. **Affiliate commissions** (2-5%) from grocery platform orders
2. **Premium subscription** (₹99-199/month) for price comparison + auto-cart
3. **Brand partnerships** — contextual product recommendations
4. **WhatsApp Business API** via BSP (Gupshup/Twilio) for production

## Phases
- **Phase 1 (DONE):** Web app MVP — auth, food DB, dashboard, meal plan, grocery, pantry
- **Phase 2 (DONE):** Swiggy import (130 orders) + restaurant food analysis (140 dishes)
- **Phase 2.5 (DONE):** Master DB + weekly templates + grocery days + smart food catalog + mobile responsive
- **Phase 3 (IN PROGRESS):** WhatsApp-first — Kiket Fitty as primary interface, Playwright scrapers, cron jobs
- **Phase 4:** WhatsApp Business API + affiliate links + premium tier + multi-user launch
- **Phase 5:** Scale — more cities, more platforms, brand partnerships
