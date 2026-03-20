#!/usr/bin/env node
/**
 * BigBasket Order History Scraper for ClawdBot/NutriPlan
 *
 * Usage:
 *   node bigbasket-import.js --phone 8618088374 --otp 1234
 *   node bigbasket-import.js --phone 8618088374 --wait-for-otp
 *
 * Outputs JSON array of orders to stdout.
 * All log/status messages go to stderr so stdout stays clean JSON.
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
  process.stderr.write(`[bigbasket] ${msg}\n`);
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
    // Timeout after 5 minutes
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

  // Try navigating to order history page
  await page.goto('https://www.bigbasket.com/order/order-history/', {
    waitUntil: 'domcontentloaded',
    timeout: NAV_TIMEOUT,
  });
  await page.waitForTimeout(3000);

  const orders = [];
  let pageNum = 1;
  const maxPages = 20;

  while (pageNum <= maxPages) {
    log(`Scraping page ${pageNum}...`);

    // Wait for order cards to load
    const orderCards = await page.$$('[data-testid="order-card"], .order-card, .order-item, [class*="order"]');

    if (orderCards.length === 0 && pageNum === 1) {
      // Try alternate selectors for BigBasket's layout
      const altCards = await page.$$('.past-order, .order-history-item, [class*="OrderCard"], [class*="order-card"]');
      if (altCards.length === 0) {
        log('No order cards found. Page might have different structure.');
        // Dump page text for debugging
        const bodyText = await page.textContent('body').catch(() => '');
        log(`Page content preview: ${bodyText.substring(0, 500)}`);
        break;
      }
    }

    // Extract order data from the page
    const pageOrders = await page.evaluate(() => {
      const results = [];

      // BigBasket order history selectors (may change -- try multiple)
      const cards = document.querySelectorAll(
        '[data-testid="order-card"], .order-card, .order-item, .past-order, [class*="OrderCard"], [class*="order-history"]'
      );

      cards.forEach((card) => {
        try {
          // Extract order ID
          const orderIdEl = card.querySelector('[class*="order-id"], [class*="orderId"], .order-number');
          const orderId = orderIdEl
            ? orderIdEl.textContent.replace(/[^0-9]/g, '')
            : `bb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

          // Extract date
          const dateEl = card.querySelector('[class*="date"], [class*="Date"], time');
          const dateText = dateEl ? dateEl.textContent.trim() : '';

          // Extract total
          const totalEl = card.querySelector('[class*="total"], [class*="amount"], [class*="price"]');
          const totalText = totalEl ? totalEl.textContent.replace(/[^0-9.]/g, '') : '0';

          // Extract items within the order card
          const itemEls = card.querySelectorAll(
            '[class*="item"], [class*="product"], li'
          );
          const items = [];

          itemEls.forEach((itemEl) => {
            const nameEl = itemEl.querySelector('[class*="name"], [class*="title"], [class*="product-name"]');
            const qtyEl = itemEl.querySelector('[class*="qty"], [class*="quantity"]');
            const priceEl = itemEl.querySelector('[class*="price"], [class*="cost"]');
            const brandEl = itemEl.querySelector('[class*="brand"]');
            const weightEl = itemEl.querySelector('[class*="weight"], [class*="size"], [class*="pack"]');

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
            restaurant_name: 'BigBasket',
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
    log(`Found ${pageOrders.length} orders on page ${pageNum}`);

    // Check for next page / load more
    const nextBtn = await page.$(
      'button:has-text("Next"), button:has-text("Load More"), [class*="next"], [class*="load-more"], [data-testid="next-page"]'
    );
    if (nextBtn) {
      const isDisabled = await nextBtn.getAttribute('disabled');
      if (isDisabled !== null) break;
      await nextBtn.click();
      await page.waitForTimeout(2000);
      pageNum++;
    } else {
      break;
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

    // Navigate to BigBasket
    log('Opening BigBasket...');
    await page.goto('https://www.bigbasket.com/', {
      waitUntil: 'domcontentloaded',
      timeout: NAV_TIMEOUT,
    });
    await page.waitForTimeout(2000);

    // Click login/sign-in
    log('Looking for login button...');
    const loginBtn = await page.$(
      'button:has-text("Login"), a:has-text("Login"), a:has-text("Sign In"), [class*="login"], [data-testid="login"]'
    );
    if (loginBtn) {
      await loginBtn.click();
      await page.waitForTimeout(2000);
    } else {
      // Try navigating directly to login
      await page.goto('https://www.bigbasket.com/skip_pg_,_login/', {
        waitUntil: 'domcontentloaded',
        timeout: NAV_TIMEOUT,
      });
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

      // Click continue/send OTP
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

    // Enter OTP -- BigBasket typically uses individual digit inputs
    const otpInputs = await page.$$('input[type="tel"][maxlength="1"], input[type="number"][maxlength="1"], input[class*="otp"]');
    if (otpInputs.length >= 4) {
      for (let i = 0; i < otpCode.length && i < otpInputs.length; i++) {
        await otpInputs[i].fill(otpCode[i]);
        await page.waitForTimeout(100);
      }
    } else {
      // Single OTP input field
      const singleOtpInput = await page.$(
        'input[type="tel"], input[name="otp"], input[placeholder*="OTP"], input[placeholder*="otp"]'
      );
      if (singleOtpInput) {
        await singleOtpInput.fill(otpCode);
      }
    }

    // Submit OTP
    const verifyBtn = await page.$(
      'button:has-text("Verify"), button:has-text("Submit"), button:has-text("Continue"), button[type="submit"]'
    );
    if (verifyBtn) {
      await verifyBtn.click();
      log('OTP submitted, waiting for login...');
      await page.waitForTimeout(5000);
    }

    // Check if logged in
    const currentUrl = page.url();
    log(`Current URL after login: ${currentUrl}`);

    // Scrape orders
    const orders = await scrapeOrders(page);
    log(`Total orders scraped: ${orders.length}`);

    // Output clean JSON to stdout
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
