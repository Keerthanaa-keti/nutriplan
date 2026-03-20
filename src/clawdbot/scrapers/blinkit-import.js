#!/usr/bin/env node
/**
 * Blinkit Order History Scraper for ClawdBot/NutriPlan
 *
 * Usage:
 *   node blinkit-import.js --phone 8618088374 --otp 1234
 *   node blinkit-import.js --phone 8618088374 --wait-for-otp
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
  process.stderr.write(`[blinkit] ${msg}\n`);
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

  // Blinkit order history
  await page.goto('https://blinkit.com/orders', {
    waitUntil: 'domcontentloaded',
    timeout: NAV_TIMEOUT,
  });
  await page.waitForTimeout(3000);

  const orders = [];
  let pageNum = 1;
  const maxPages = 20;

  while (pageNum <= maxPages) {
    log(`Scraping page ${pageNum}...`);

    const pageOrders = await page.evaluate(() => {
      const results = [];
      const cards = document.querySelectorAll(
        '[class*="OrderCard"], [class*="order-card"], [class*="order-item"], [data-testid*="order"]'
      );

      cards.forEach((card) => {
        try {
          const orderIdEl = card.querySelector('[class*="order-id"], [class*="orderId"]');
          const orderId = orderIdEl
            ? orderIdEl.textContent.replace(/[^0-9]/g, '')
            : `bk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

          const dateEl = card.querySelector('[class*="date"], [class*="Date"], time');
          const dateText = dateEl ? dateEl.textContent.trim() : '';

          const totalEl = card.querySelector('[class*="total"], [class*="amount"], [class*="price"]');
          const totalText = totalEl ? totalEl.textContent.replace(/[^0-9.]/g, '') : '0';

          const itemEls = card.querySelectorAll('[class*="item"], [class*="product"]');
          const items = [];

          itemEls.forEach((itemEl) => {
            const nameEl = itemEl.querySelector('[class*="name"], [class*="title"]');
            const qtyEl = itemEl.querySelector('[class*="qty"], [class*="quantity"]');
            const priceEl = itemEl.querySelector('[class*="price"], [class*="cost"]');
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
            restaurant_name: 'Blinkit',
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

    // If no orders found on first page, try clicking into order details
    if (pageOrders.length === 0 && pageNum === 1) {
      // Blinkit sometimes shows order summary cards that need to be clicked
      const summaryCards = await page.$$('[class*="order"], a[href*="order"]');
      log(`Found ${summaryCards.length} clickable order elements`);

      for (const card of summaryCards.slice(0, 50)) {
        try {
          const href = await card.getAttribute('href');
          if (href && href.includes('order')) {
            await page.goto(`https://blinkit.com${href}`, {
              waitUntil: 'domcontentloaded',
              timeout: NAV_TIMEOUT,
            });
            await page.waitForTimeout(2000);

            const detailOrder = await page.evaluate(() => {
              const items = [];
              document.querySelectorAll('[class*="item"], [class*="product"]').forEach((el) => {
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

              const totalEl = document.querySelector('[class*="total"], [class*="grand"]');
              const dateEl = document.querySelector('[class*="date"], time');
              const orderIdEl = document.querySelector('[class*="order-id"]');

              return {
                platform_order_id: orderIdEl?.textContent.replace(/[^0-9]/g, '') || `bk-${Date.now()}`,
                restaurant_name: 'Blinkit',
                order_date: dateEl?.textContent.trim() || '',
                total_amount: parseFloat(totalEl?.textContent.replace(/[^0-9.]/g, '') || '0'),
                items,
              };
            });

            if (detailOrder.items.length > 0) {
              orders.push(detailOrder);
            }

            await page.goBack({ waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(1000);
          }
        } catch {
          // Continue to next order
        }
      }
      break;
    }

    // Check for next page
    const nextBtn = await page.$(
      'button:has-text("Next"), button:has-text("Load More"), [class*="next"], [class*="load-more"]'
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

    // Navigate to Blinkit
    log('Opening Blinkit...');
    await page.goto('https://blinkit.com/', {
      waitUntil: 'domcontentloaded',
      timeout: NAV_TIMEOUT,
    });
    await page.waitForTimeout(2000);

    // Click login
    log('Looking for login...');
    const loginBtn = await page.$(
      'button:has-text("Login"), a:has-text("Login"), [class*="login"], [data-testid*="login"]'
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

    // Enter OTP
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

    // Scrape orders
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
