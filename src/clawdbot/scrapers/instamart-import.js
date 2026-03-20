#!/usr/bin/env node
/**
 * Swiggy Instamart Order History Scraper for ClawdBot/NutriPlan
 *
 * Usage:
 *   node instamart-import.js --phone 8618088374 --otp 1234
 *   node instamart-import.js --phone 8618088374 --wait-for-otp
 *
 * Outputs JSON array of orders to stdout.
 * This scrapes Swiggy's Instamart orders via mobile web (no API available).
 */

const { chromium } = require('playwright');

const MOBILE_VIEWPORT = { width: 390, height: 844 };
const MOBILE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

const TIMEOUT = 30_000;
const NAV_TIMEOUT = 45_000;
const SWIGGY_BASE = 'https://www.swiggy.com';

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = { phone: null, otp: null, waitForOtp: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--phone' && args[i + 1]) parsed.phone = args[++i];
    if (args[i] === '--otp' && args[i + 1]) parsed.otp = args[++i];
    if (args[i] === '--wait-for-otp') parsed.waitForOtp = true;
  }
  return parsed;
}

function log(msg) {
  process.stderr.write(`[instamart] ${msg}\n`);
}

async function waitForOtpFromStdin() {
  return new Promise((resolve) => {
    process.stdout.write('WAITING_FOR_OTP\n');
    log('Waiting for OTP on stdin...');
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      data += chunk.trim();
      if (data.length >= 4) {
        process.stdin.pause();
        resolve(data.trim());
      }
    });
    process.stdin.resume();
    setTimeout(() => {
      if (!data) {
        log('OTP timeout after 5 minutes');
        process.exit(1);
      }
    }, 300_000);
  });
}

async function interceptInstamartApi(page) {
  // Swiggy uses internal APIs for order listing -- intercept network requests
  const interceptedOrders = [];

  page.on('response', async (response) => {
    const url = response.url();
    // Look for Instamart order history API calls
    if (
      url.includes('/api/instamart/order') ||
      url.includes('/mapi/order') ||
      url.includes('/dapi/order') ||
      url.includes('order/history') ||
      url.includes('order/all')
    ) {
      try {
        const json = await response.json();
        log(`Intercepted API response from: ${url}`);
        if (json.data && Array.isArray(json.data.orders)) {
          interceptedOrders.push(...json.data.orders);
        } else if (Array.isArray(json.data)) {
          interceptedOrders.push(...json.data);
        } else if (json.statusMessage === 'success' && json.data) {
          interceptedOrders.push(json.data);
        }
      } catch {
        // Not JSON or different structure
      }
    }
  });

  return interceptedOrders;
}

async function scrapeOrders(page, interceptedOrders) {
  log('Navigating to Instamart order history...');

  // Try Swiggy's Instamart order page
  const orderUrls = [
    `${SWIGGY_BASE}/my-account/orders`,
    `${SWIGGY_BASE}/instamart/account/orders`,
    `${SWIGGY_BASE}/account/orders`,
  ];

  for (const url of orderUrls) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
      await page.waitForTimeout(3000);

      // Check if we got redirected to login
      if (page.url().includes('login') || page.url().includes('auth')) {
        log(`Redirected to login from ${url}, skipping`);
        continue;
      }

      log(`Loaded: ${page.url()}`);
      break;
    } catch (err) {
      log(`Failed to load ${url}: ${err.message}`);
    }
  }

  // If we intercepted API orders, parse those (more reliable)
  if (interceptedOrders.length > 0) {
    log(`Using ${interceptedOrders.length} intercepted API orders`);
    return interceptedOrders.map((order) => {
      const items = (order.order_items || order.items || []).map((item) => ({
        name: item.name || item.item_name || item.product_name || 'Unknown',
        quantity: item.quantity || item.count || 1,
        price: item.price || item.total || item.final_price || 0,
        brand: item.brand || null,
        weight: item.weight || item.variant || null,
        category: 'grocery',
        is_veg: item.is_veg !== false,
      }));

      return {
        platform_order_id: String(order.order_id || order.id || `si-${Date.now()}`),
        restaurant_name: 'Swiggy Instamart',
        order_date: order.order_time || order.created_at || order.ordered_time || '',
        total_amount: order.order_total || order.bill_total || order.total_amount || 0,
        items,
      };
    });
  }

  // Fallback: DOM scraping
  log('No API interception, falling back to DOM scraping...');
  const orders = [];

  // Scroll to load all orders
  let prevCount = 0;
  for (let scroll = 0; scroll < 20; scroll++) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1500);

    const currentCount = await page.$$eval(
      '[class*="order"], [class*="Order"], [data-testid*="order"]',
      (els) => els.length
    );
    if (currentCount === prevCount && scroll > 2) break;
    prevCount = currentCount;
  }

  // Filter for Instamart orders (vs food delivery)
  const pageOrders = await page.evaluate(() => {
    const results = [];
    const cards = document.querySelectorAll(
      '[class*="order-card"], [class*="OrderCard"], [class*="orderCard"], [data-testid*="order"]'
    );

    cards.forEach((card) => {
      try {
        const text = card.textContent || '';
        // Check if this is an Instamart order (not food delivery)
        const isInstamart =
          text.toLowerCase().includes('instamart') ||
          text.toLowerCase().includes('grocery') ||
          card.querySelector('[class*="instamart"]') !== null;

        if (!isInstamart) return;

        const orderIdEl = card.querySelector('[class*="order-id"], [class*="orderId"]');
        const orderId = orderIdEl
          ? orderIdEl.textContent.replace(/[^0-9]/g, '')
          : `si-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        const dateEl = card.querySelector('[class*="date"], [class*="Date"], [class*="time"], time');
        const dateText = dateEl ? dateEl.textContent.trim() : '';

        const totalEl = card.querySelector('[class*="total"], [class*="amount"], [class*="price"], [class*="bill"]');
        const totalText = totalEl ? totalEl.textContent.replace(/[^0-9.]/g, '') : '0';

        const itemEls = card.querySelectorAll('[class*="item"], [class*="product"]');
        const items = [];

        itemEls.forEach((itemEl) => {
          const nameEl = itemEl.querySelector('[class*="name"], [class*="title"]');
          const qtyEl = itemEl.querySelector('[class*="qty"], [class*="quantity"]');
          const priceEl = itemEl.querySelector('[class*="price"]');
          const brandEl = itemEl.querySelector('[class*="brand"]');
          const weightEl = itemEl.querySelector('[class*="weight"], [class*="size"]');

          if (nameEl) {
            items.push({
              name: nameEl.textContent.trim(),
              quantity: parseInt(qtyEl?.textContent.replace(/[^0-9]/g, '') || '1', 10),
              price: parseFloat(priceEl?.textContent.replace(/[^0-9.]/g, '') || '0'),
              brand: brandEl?.textContent.trim() || null,
              weight: weightEl?.textContent.trim() || null,
              category: 'grocery',
              is_veg: true,
            });
          }
        });

        results.push({
          platform_order_id: orderId,
          restaurant_name: 'Swiggy Instamart',
          order_date: dateText,
          total_amount: parseFloat(totalText) || 0,
          items,
        });
      } catch {
        // Skip malformed cards
      }
    });

    return results;
  });

  orders.push(...pageOrders);

  // If we found orders but no items, click into each for details
  if (orders.length > 0 && orders.every((o) => o.items.length === 0)) {
    log('Clicking into order details for items...');
    const orderLinks = await page.$$('a[href*="order"], [class*="order"] a');

    for (let i = 0; i < Math.min(orderLinks.length, orders.length); i++) {
      try {
        await orderLinks[i].click();
        await page.waitForTimeout(2500);

        const detailItems = await page.evaluate(() => {
          const items = [];
          document.querySelectorAll('[class*="item"], [class*="product"], [class*="line-item"]').forEach((el) => {
            const name = el.querySelector('[class*="name"], [class*="title"]');
            const qty = el.querySelector('[class*="qty"], [class*="quantity"]');
            const price = el.querySelector('[class*="price"]');
            if (name) {
              items.push({
                name: name.textContent.trim(),
                quantity: parseInt(qty?.textContent.replace(/[^0-9]/g, '') || '1', 10),
                price: parseFloat(price?.textContent.replace(/[^0-9.]/g, '') || '0'),
                category: 'grocery',
                is_veg: true,
              });
            }
          });
          return items;
        });

        if (detailItems.length > 0) {
          orders[i].items = detailItems;
        }

        await page.goBack({ waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(1000);
      } catch {
        // Continue
      }
    }
  }

  return orders;
}

async function main() {
  const { phone, otp, waitForOtp } = parseArgs();

  if (!phone) {
    log('Error: --phone is required');
    process.exit(1);
  }

  if (!otp && !waitForOtp) {
    log('Error: either --otp or --wait-for-otp is required');
    process.exit(1);
  }

  let browser;
  try {
    log('Launching browser...');
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const context = await browser.newContext({
      viewport: MOBILE_VIEWPORT,
      userAgent: MOBILE_UA,
      locale: 'en-IN',
      timezoneId: 'Asia/Kolkata',
    });

    const page = await context.newPage();
    page.setDefaultTimeout(TIMEOUT);

    // Set up API interception before navigation
    const interceptedOrders = await interceptInstamartApi(page);

    // Navigate to Swiggy
    log('Opening Swiggy...');
    await page.goto(SWIGGY_BASE, {
      waitUntil: 'domcontentloaded',
      timeout: NAV_TIMEOUT,
    });
    await page.waitForTimeout(2000);

    // Click login
    log('Looking for login...');
    const loginBtn = await page.$(
      'button:has-text("Login"), a:has-text("Login"), a:has-text("Sign in"), [class*="login"], [data-testid*="login"]'
    );
    if (loginBtn) {
      await loginBtn.click();
      await page.waitForTimeout(2000);
    } else {
      // Try direct login URL
      await page.goto(`${SWIGGY_BASE}/auth`, {
        waitUntil: 'domcontentloaded',
        timeout: NAV_TIMEOUT,
      });
      await page.waitForTimeout(2000);
    }

    // Enter phone number
    log(`Entering phone number: ${phone.slice(0, 4)}****`);
    const phoneInput = await page.$(
      'input[type="tel"], input[name="phone"], input[name="mobile"], input[id="mobile"], input[placeholder*="phone"], input[placeholder*="mobile"], input[placeholder*="number"]'
    );
    if (phoneInput) {
      await phoneInput.fill(phone);
      await page.waitForTimeout(500);

      const continueBtn = await page.$(
        'button:has-text("Continue"), button:has-text("Send"), button:has-text("OTP"), button:has-text("LOGIN"), button[type="submit"], a:has-text("LOGIN")'
      );
      if (continueBtn) {
        await continueBtn.click();
        log('OTP requested');
        await page.waitForTimeout(3000);
      }
    } else {
      log('Warning: Could not find phone input field');
    }

    // Get OTP
    let otpCode = otp;
    if (waitForOtp) {
      otpCode = await waitForOtpFromStdin();
    }
    log('Entering OTP...');

    const otpInputs = await page.$$('input[type="tel"][maxlength="1"], input[type="number"][maxlength="1"], input[class*="otp"]');
    if (otpInputs.length >= 4) {
      for (let i = 0; i < otpCode.length && i < otpInputs.length; i++) {
        await otpInputs[i].fill(otpCode[i]);
        await page.waitForTimeout(100);
      }
    } else {
      const singleOtpInput = await page.$(
        'input[type="tel"], input[name="otp"], input[placeholder*="OTP"]'
      );
      if (singleOtpInput) {
        await singleOtpInput.fill(otpCode);
      }
    }

    const verifyBtn = await page.$(
      'button:has-text("Verify"), button:has-text("Submit"), button:has-text("Continue"), button:has-text("LOGIN"), button[type="submit"]'
    );
    if (verifyBtn) {
      await verifyBtn.click();
      log('OTP submitted, waiting for login...');
      await page.waitForTimeout(5000);
    }

    log(`Current URL after login: ${page.url()}`);

    // Scrape orders
    const orders = await scrapeOrders(page, interceptedOrders);
    log(`Total orders scraped: ${orders.length}`);

    process.stdout.write(JSON.stringify(orders, null, 2));

    await browser.close();
    process.exit(0);
  } catch (err) {
    log(`Error: ${err.message}`);
    if (browser) await browser.close().catch(() => {});
    process.exit(1);
  }
}

main();
