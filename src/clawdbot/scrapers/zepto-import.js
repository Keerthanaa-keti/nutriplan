#!/usr/bin/env node
/**
 * Zepto Order History Scraper for ClawdBot/NutriPlan
 *
 * Usage:
 *   node zepto-import.js --phone 8618088374 --otp 1234
 *   node zepto-import.js --phone 8618088374 --wait-for-otp
 *
 * Outputs JSON array of orders to stdout.
 */

const { chromium } = require('playwright');

const MOBILE_VIEWPORT = { width: 390, height: 844 };
const MOBILE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

const TIMEOUT = 30_000;
const NAV_TIMEOUT = 45_000;

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
  process.stderr.write(`[zepto] ${msg}\n`);
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

async function scrapeOrders(page) {
  log('Navigating to order history...');

  // Zepto uses zepto.com now
  await page.goto('https://www.zepto.com/account/orders', {
    waitUntil: 'domcontentloaded',
    timeout: NAV_TIMEOUT,
  });
  await page.waitForTimeout(3000);

  const orders = [];
  let hasMore = true;
  let scrollAttempts = 0;
  const maxScrollAttempts = 30;

  while (hasMore && scrollAttempts < maxScrollAttempts) {
    const pageOrders = await page.evaluate((existingCount) => {
      const results = [];
      const cards = document.querySelectorAll(
        '[class*="order-card"], [class*="OrderCard"], [class*="order-item"], [data-testid*="order"], [class*="past-order"]'
      );

      // Only process cards we haven't seen yet
      const newCards = Array.from(cards).slice(existingCount);

      newCards.forEach((card) => {
        try {
          const orderIdEl = card.querySelector('[class*="order-id"], [class*="orderId"]');
          const orderId = orderIdEl
            ? orderIdEl.textContent.replace(/[^0-9]/g, '')
            : `zp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

          const dateEl = card.querySelector('[class*="date"], [class*="Date"], time');
          const dateText = dateEl ? dateEl.textContent.trim() : '';

          const totalEl = card.querySelector('[class*="total"], [class*="amount"], [class*="price"]');
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
            restaurant_name: 'Zepto',
            order_date: dateText,
            total_amount: parseFloat(totalText) || 0,
            items,
          });
        } catch {
          // Skip malformed cards
        }
      });

      return results;
    }, orders.length);

    if (pageOrders.length === 0) {
      scrollAttempts++;
      // Scroll down to trigger lazy loading
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(1500);

      // Also try clicking "Load More" if present
      const loadMoreBtn = await page.$(
        'button:has-text("Load More"), button:has-text("Show More"), [class*="load-more"]'
      );
      if (loadMoreBtn) {
        await loadMoreBtn.click();
        await page.waitForTimeout(2000);
        scrollAttempts = 0; // Reset since we found a button
      } else if (scrollAttempts >= 3) {
        hasMore = false;
      }
    } else {
      orders.push(...pageOrders);
      log(`Found ${pageOrders.length} more orders (total: ${orders.length})`);
      scrollAttempts = 0;
    }
  }

  // If list view didn't show items, try clicking into each order
  if (orders.length > 0 && orders.every((o) => o.items.length === 0)) {
    log('Orders found but no items -- clicking into order details...');
    const orderLinks = await page.$$('a[href*="order"], [class*="order-card"] a, [data-testid*="order"] a');

    for (let i = 0; i < Math.min(orderLinks.length, orders.length); i++) {
      try {
        const href = await orderLinks[i].getAttribute('href');
        if (!href) continue;

        const fullUrl = href.startsWith('http') ? href : `https://www.zepto.com${href}`;
        await page.goto(fullUrl, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
        await page.waitForTimeout(2000);

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
        // Continue to next order
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

    // Navigate to Zepto
    log('Opening Zepto...');
    await page.goto('https://www.zepto.com/', {
      waitUntil: 'domcontentloaded',
      timeout: NAV_TIMEOUT,
    });
    await page.waitForTimeout(2000);

    // Click login
    log('Looking for login...');
    const loginBtn = await page.$(
      'button:has-text("Login"), a:has-text("Login"), a:has-text("Sign In"), [class*="login"], [data-testid*="login"]'
    );
    if (loginBtn) {
      await loginBtn.click();
      await page.waitForTimeout(2000);
    }

    // Enter phone number
    log(`Entering phone number: ${phone.slice(0, 4)}****`);
    const phoneInput = await page.$(
      'input[type="tel"], input[name="phone"], input[name="mobile"], input[placeholder*="phone"], input[placeholder*="mobile"], input[placeholder*="number"]'
    );
    if (phoneInput) {
      await phoneInput.fill(phone);
      await page.waitForTimeout(500);

      const continueBtn = await page.$(
        'button:has-text("Continue"), button:has-text("Send"), button:has-text("OTP"), button[type="submit"]'
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
      'button:has-text("Verify"), button:has-text("Submit"), button:has-text("Continue"), button[type="submit"]'
    );
    if (verifyBtn) {
      await verifyBtn.click();
      log('OTP submitted, waiting for login...');
      await page.waitForTimeout(5000);
    }

    log(`Current URL after login: ${page.url()}`);

    const orders = await scrapeOrders(page);
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
