import { chromium, Browser, Page } from 'playwright';

export interface PriceResult {
  platform: string;
  product_name: string;
  brand: string;
  price: number;
  pack_size: string;
  url: string;
  in_stock: boolean;
}

const MOBILE_USER_AGENT =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

const VIEWPORT = { width: 375, height: 812 };
const SELECTOR_TIMEOUT = 10_000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function newPage(browser: Browser): Promise<Page> {
  const context = await browser.newContext({
    userAgent: MOBILE_USER_AGENT,
    viewport: VIEWPORT,
    locale: 'en-IN',
    timezoneId: 'Asia/Kolkata',
  });
  return context.newPage();
}

function parsePrice(raw: string): number {
  // Remove currency symbols, commas, whitespace — keep digits and dots
  const cleaned = raw.replace(/[^\d.]/g, '');
  return parseFloat(cleaned) || 0;
}

// ---------------------------------------------------------------------------
// BigBasket
// ---------------------------------------------------------------------------

async function scrapeBigBasket(
  browser: Browser,
  query: string,
): Promise<PriceResult[]> {
  const results: PriceResult[] = [];
  const page = await newPage(browser);

  try {
    const url = `https://www.bigbasket.com/ps/?q=${encodeURIComponent(query)}`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15_000 });

    // BigBasket renders product cards in various containers; try multiple selectors
    const cardSelectors = [
      '[data-testid="product-card"]',
      '.ProductCard___StyledDiv',
      'li[class*="product"]',
      'div[class*="SKUDeck"]',
      'section ul > li',
    ];

    let cardsLocator = null;
    for (const sel of cardSelectors) {
      try {
        await page.waitForSelector(sel, { timeout: SELECTOR_TIMEOUT });
        cardsLocator = sel;
        break;
      } catch {
        // try next selector
      }
    }

    if (!cardsLocator) {
      console.warn('[BigBasket] No product cards found for:', query);
      return results;
    }

    const cards = await page.$$(cardsLocator);
    const limit = Math.min(cards.length, 3);

    for (let i = 0; i < limit; i++) {
      try {
        const card = cards[i];
        const name =
          (await card.$eval(
            'h3, [class*="ProductName"], [class*="product-name"], a[title]',
            (el) => el.textContent?.trim() || (el as HTMLAnchorElement).title || '',
          )) || '';
        const brand =
          (await card
            .$eval(
              '[class*="Brand"], [class*="brand"], span[class*="Label"]',
              (el) => el.textContent?.trim() || '',
            )
            .catch(() => '')) || '';
        const priceText =
          (await card.$eval(
            '[class*="Price"], [class*="price"], span[class*="discounted"]',
            (el) => el.textContent?.trim() || '',
          )) || '0';
        const packSize =
          (await card
            .$eval(
              '[class*="PackSize"], [class*="pack-size"], [class*="weight"], [class*="qty"]',
              (el) => el.textContent?.trim() || '',
            )
            .catch(() => '')) || '';
        const link =
          (await card
            .$eval('a[href]', (el) => (el as HTMLAnchorElement).href)
            .catch(() => '')) || '';

        if (name) {
          results.push({
            platform: 'bigbasket',
            product_name: name,
            brand,
            price: parsePrice(priceText),
            pack_size: packSize,
            url: link.startsWith('http')
              ? link
              : `https://www.bigbasket.com${link}`,
            in_stock: true,
          });
        }
      } catch (err) {
        console.warn(`[BigBasket] Failed to parse card ${i}:`, err);
      }
    }
  } catch (err) {
    console.error('[BigBasket] Scrape error:', err);
  } finally {
    await page.close();
  }

  return results;
}

// ---------------------------------------------------------------------------
// Blinkit
// ---------------------------------------------------------------------------

async function scrapeBlinkit(
  browser: Browser,
  query: string,
): Promise<PriceResult[]> {
  const results: PriceResult[] = [];
  const page = await newPage(browser);

  try {
    const url = `https://blinkit.com/s/?q=${encodeURIComponent(query)}`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15_000 });

    const cardSelectors = [
      '[data-testid="plp-product"]',
      'div[class*="Product__"]',
      'a[class*="Product"]',
      'div[class*="product-card"]',
      '.product-card',
    ];

    let cardsLocator = null;
    for (const sel of cardSelectors) {
      try {
        await page.waitForSelector(sel, { timeout: SELECTOR_TIMEOUT });
        cardsLocator = sel;
        break;
      } catch {
        // try next
      }
    }

    if (!cardsLocator) {
      console.warn('[Blinkit] No product cards found for:', query);
      return results;
    }

    const cards = await page.$$(cardsLocator);
    const limit = Math.min(cards.length, 3);

    for (let i = 0; i < limit; i++) {
      try {
        const card = cards[i];
        const name =
          (await card.$eval(
            '[class*="Name"], [class*="name"], div[class*="title"]',
            (el) => el.textContent?.trim() || '',
          )) || '';
        const priceText =
          (await card.$eval(
            '[class*="Price"], [class*="price"]',
            (el) => el.textContent?.trim() || '',
          )) || '0';
        const packSize =
          (await card
            .$eval(
              '[class*="Weight"], [class*="weight"], [class*="size"], [class*="quantity"]',
              (el) => el.textContent?.trim() || '',
            )
            .catch(() => '')) || '';
        const link =
          (await card
            .$eval('a[href]', (el) => (el as HTMLAnchorElement).href)
            .catch(() => '')) || '';

        // Blinkit sometimes shows out-of-stock cards
        const outOfStock = await card
          .$eval(
            '[class*="outOfStock"], [class*="out-of-stock"], [class*="Sold"]',
            () => true,
          )
          .catch(() => false);

        if (name) {
          results.push({
            platform: 'blinkit',
            product_name: name,
            brand: '', // Blinkit usually includes brand in name
            price: parsePrice(priceText),
            pack_size: packSize,
            url: link.startsWith('http') ? link : `https://blinkit.com${link}`,
            in_stock: !outOfStock,
          });
        }
      } catch (err) {
        console.warn(`[Blinkit] Failed to parse card ${i}:`, err);
      }
    }
  } catch (err) {
    console.error('[Blinkit] Scrape error:', err);
  } finally {
    await page.close();
  }

  return results;
}

// ---------------------------------------------------------------------------
// Zepto
// ---------------------------------------------------------------------------

async function scrapeZepto(
  browser: Browser,
  query: string,
): Promise<PriceResult[]> {
  const results: PriceResult[] = [];
  const page = await newPage(browser);

  try {
    const url = `https://www.zepto.com/search?query=${encodeURIComponent(query)}`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15_000 });

    const cardSelectors = [
      '[data-testid="product-card"]',
      'a[class*="product"]',
      'div[class*="ProductCard"]',
      '[class*="searchProduct"]',
      'div[class*="product-card"]',
    ];

    let cardsLocator = null;
    for (const sel of cardSelectors) {
      try {
        await page.waitForSelector(sel, { timeout: SELECTOR_TIMEOUT });
        cardsLocator = sel;
        break;
      } catch {
        // try next
      }
    }

    if (!cardsLocator) {
      console.warn('[Zepto] No product cards found for:', query);
      return results;
    }

    const cards = await page.$$(cardsLocator);
    const limit = Math.min(cards.length, 3);

    for (let i = 0; i < limit; i++) {
      try {
        const card = cards[i];
        const name =
          (await card.$eval(
            'h5, h4, h3, [class*="Name"], [class*="name"], [class*="title"]',
            (el) => el.textContent?.trim() || '',
          )) || '';
        const priceText =
          (await card.$eval(
            '[class*="Price"], [class*="price"], span[class*="amount"]',
            (el) => el.textContent?.trim() || '',
          )) || '0';
        const packSize =
          (await card
            .$eval(
              '[class*="Quantity"], [class*="quantity"], [class*="weight"], [class*="variant"]',
              (el) => el.textContent?.trim() || '',
            )
            .catch(() => '')) || '';
        const link =
          (await card
            .$eval('a[href]', (el) => (el as HTMLAnchorElement).href)
            .catch(() => '')) || '';

        if (name) {
          results.push({
            platform: 'zepto',
            product_name: name,
            brand: '',
            price: parsePrice(priceText),
            pack_size: packSize,
            url: link.startsWith('http')
              ? link
              : `https://www.zepto.com${link}`,
            in_stock: true,
          });
        }
      } catch (err) {
        console.warn(`[Zepto] Failed to parse card ${i}:`, err);
      }
    }
  } catch (err) {
    console.error('[Zepto] Scrape error:', err);
  } finally {
    await page.close();
  }

  return results;
}

// ---------------------------------------------------------------------------
// Platform registry
// ---------------------------------------------------------------------------

const SCRAPERS: Record<
  string,
  (browser: Browser, query: string) => Promise<PriceResult[]>
> = {
  bigbasket: scrapeBigBasket,
  blinkit: scrapeBlinkit,
  zepto: scrapeZepto,
};

const ALL_PLATFORMS = Object.keys(SCRAPERS);

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function scrapePrice(
  query: string,
  platforms?: string[],
): Promise<PriceResult[]> {
  const targetPlatforms = (platforms || ALL_PLATFORMS).filter(
    (p) => p in SCRAPERS,
  );

  if (targetPlatforms.length === 0) {
    return [];
  }

  let browser: Browser | null = null;
  const allResults: PriceResult[] = [];

  try {
    browser = await chromium.launch({ headless: true });

    for (let i = 0; i < targetPlatforms.length; i++) {
      const platform = targetPlatforms[i];
      try {
        console.log(`[PriceScraper] Scraping ${platform} for "${query}"`);
        const results = await SCRAPERS[platform](browser, query);
        allResults.push(...results);
      } catch (err) {
        console.error(`[PriceScraper] ${platform} failed:`, err);
      }

      // Delay between platforms (skip after last)
      if (i < targetPlatforms.length - 1) {
        await delay(1000 + Math.random() * 1000);
      }
    }
  } catch (err) {
    console.error('[PriceScraper] Browser launch error:', err);
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  return allResults;
}

export { ALL_PLATFORMS };
