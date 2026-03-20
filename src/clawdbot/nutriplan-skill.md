# NutriPlan Integration Skill

You have access to NutriPlan, a nutrition and grocery planning app for Keti and Kishore's household. You can import grocery orders from delivery platforms, check prices, and manage weekly plans.

## Known Users
- **Keti** (Keerthanaa): profile in NutriPlan, eggitarian, 1400-1450 kcal target
- **Kishore**: profile in NutriPlan, non-veg, 1800 kcal target
- **Phone (Keti):** 8618088374
- **Phone (Kishore):** 9965802274

## NutriPlan API Base
- Local dev: `http://localhost:3000`
- ClawdBot bridge: `http://localhost:3000/api/clawdbot`

---

## Commands

### "import my [platform] orders"
Supported platforms: BigBasket, Blinkit, Zepto, Swiggy Instamart

**Flow:**
1. Determine which platform (bigbasket / blinkit / zepto / instamart)
2. Ask for phone number if not known (check known users above first)
3. Tell user: "Opening [platform] now. I'll need your OTP when it arrives on your phone."
4. Run the scraper via terminal skill:
   ```
   node /Users/keti/Documents/keti-claude-experiments/nutriplan/src/clawdbot/scrapers/[platform]-import.js --phone [number] --wait-for-otp
   ```
   This will print `WAITING_FOR_OTP` to stdout and pause.
5. Ask user: "Please send me the OTP you received"
6. When user sends the OTP, write it to the scraper's stdin or run:
   ```
   node /Users/keti/Documents/keti-claude-experiments/nutriplan/src/clawdbot/scrapers/[platform]-import.js --phone [number] --otp [code]
   ```
7. The scraper outputs JSON to stdout with the scraped orders
8. POST the JSON to the ClawdBot bridge:
   ```
   curl -X POST http://localhost:3000/api/clawdbot \
     -H "Content-Type: application/json" \
     -H "X-Service-Key: clawdbot-nutriplan-bridge" \
     -d '{"action":"import","platform":"[platform]","member_name":"[name]","order_type":"grocery","orders":[...scraped data...]}'
   ```
9. Reply with summary: "Imported X orders with Y unique items from [platform]"

### "compare prices for [item]"
Check prices across BigBasket, Blinkit, Zepto, Swiggy Instamart for a specific item.

**Flow:**
1. Extract the item name from the message
2. Call the ClawdBot bridge:
   ```
   curl "http://localhost:3000/api/clawdbot?action=price-check&query=[item]"
   ```
3. Format results as a WhatsApp-friendly comparison:
   ```
   Paneer 200g prices:
   - BigBasket: Rs.85 (Farm Connect)
   - Blinkit: Rs.90 (Amul)
   - Zepto: Rs.88 (Chitale)
   - Instamart: Rs.92 (Amul)
   Cheapest: BigBasket Rs.85
   ```

### "my grocery list" / "what do I need to order"
Show the current week's grocery list split into Monday + Thursday orders.

**Flow:**
1. Determine which user is asking (Keti or Kishore)
2. Call the ClawdBot bridge:
   ```
   curl "http://localhost:3000/api/clawdbot?action=grocery-list&member_name=[name]"
   ```
3. Format as WhatsApp message:
   ```
   MONDAY ORDER (Mar 17):
   Protein: 21 eggs, 700g paneer
   Dairy: 2L milk, 1kg curd
   Grains: 2kg rice, 500g daal
   Veggies: mixed seasonal
   Total: ~Rs.1,450

   THURSDAY RESTOCK (Mar 20):
   Dairy: 1L milk, 500g curd
   Veggies: fresh leafy greens
   Fruits: bananas, pomegranate
   Total: ~Rs.380

   Week total: ~Rs.1,830
   ```

### "plan my week" / "weekly plan"
Show or create a weekly meal plan.

**Flow:**
1. Call:
   ```
   curl "http://localhost:3000/api/clawdbot?action=weekly-plan&member_name=[name]"
   ```
2. Format as a brief daily summary with macro totals
3. If no plan exists, suggest templates:
   - Egg + Paneer Week
   - Egg + Chicken Week (Kishore only)
   - Egg + Sprouts Week
   - Paneer + Lentils Week

### "what did I order last week" / "order history"
Show recent order history.

**Flow:**
1. Call:
   ```
   curl "http://localhost:3000/api/clawdbot?action=order-history&member_name=[name]&limit=5"
   ```
2. Format as a brief list of recent orders

---

## Important Notes
- Always confirm before running scrapers (they open a browser)
- OTP relay: the user sends the OTP as a normal WhatsApp message, you use it in the scraper
- Never store OTPs or passwords
- The scrapers run headless Chromium via Playwright
- If a scraper fails, tell the user what went wrong and suggest retrying
- Keep responses WhatsApp-brief -- no walls of text
