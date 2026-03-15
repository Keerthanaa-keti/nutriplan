// NutriPlan - Swiggy Order Importer
// Runs on swiggy.com to capture order history

(async function () {
  // Only run on order pages
  if (!window.location.href.includes('my-account') && !window.location.href.includes('orders')) return;

  const config = await chrome.storage.local.get(['activeImport', 'memberName']);
  if (!config.activeImport || config.activeImport.app !== 'swiggy') return;

  console.log('[NutriPlan] Swiggy importer active');

  // Show import banner
  showBanner('Importing Swiggy orders...');

  try {
    const orders = await fetchAllOrders();

    if (orders.length === 0) {
      showBanner('No orders found. Make sure you are logged into Swiggy.', 'error');
      return;
    }

    showBanner(`Found ${orders.length} orders. Processing...`);

    // Normalize order data
    const normalized = orders.map(order => ({
      platform_order_id: order.order_id?.toString(),
      restaurant_name: order.restaurant_name || order.restaurant_info?.name || '',
      order_date: order.order_time || order.ordered_time,
      total_amount: parseFloat(order.order_total || order.total_amount || 0),
      items: (order.order_items || order.items || []).map(item => ({
        name: item.name || item.item_name || '',
        quantity: item.quantity || 1,
        price: parseFloat(item.total || item.price || item.final_price || 0),
        is_veg: item.is_veg === 1 || item.is_veg === true,
        category: item.category || '',
      })),
      delivery_address: order.delivery_address?.address || '',
      is_instamart: order.order_type === 'instamart' || false,
    }));

    // Send to NutriPlan
    chrome.runtime.sendMessage({
      type: 'SEND_TO_NUTRIPLAN',
      data: {
        platform: order_type_is_instamart(orders) ? 'swiggy_instamart' : 'swiggy',
        member_name: config.memberName,
        order_type: 'food_delivery',
        orders: normalized,
        imported_at: new Date().toISOString(),
      },
    });

    showBanner(`Successfully imported ${orders.length} Swiggy orders!`, 'success');

    // Clear active import
    await chrome.storage.local.remove('activeImport');

  } catch (err) {
    console.error('[NutriPlan] Swiggy import error:', err);
    showBanner(`Import error: ${err.message}`, 'error');
    chrome.runtime.sendMessage({ type: 'IMPORT_ERROR', app: 'swiggy', error: err.message });
  }
})();

function order_type_is_instamart(orders) {
  return orders.some(o => o.order_type === 'instamart');
}

async function fetchAllOrders() {
  const allOrders = [];
  let lastOrderId = '';
  let hasMore = true;
  let page = 0;

  while (hasMore && page < 50) { // Max 50 pages (~500 orders)
    try {
      const url = lastOrderId
        ? `https://www.swiggy.com/dapi/order/all?order_id=${lastOrderId}`
        : 'https://www.swiggy.com/dapi/order/all';

      const response = await fetch(url, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          '__fetch_req__': 'true',
        },
      });

      if (!response.ok) throw new Error(`API returned ${response.status}`);

      const data = await response.json();
      const orders = data?.data?.orders || [];

      if (orders.length === 0) {
        hasMore = false;
      } else {
        allOrders.push(...orders);
        lastOrderId = orders[orders.length - 1].order_id;
        page++;

        // Rate limit
        await new Promise(r => setTimeout(r, 500));
      }
    } catch (err) {
      console.error('[NutriPlan] Fetch page error:', err);
      hasMore = false;
    }
  }

  return allOrders;
}

// Fetch detailed items for each order
async function fetchOrderDetails(orderId) {
  try {
    const response = await fetch(`https://www.swiggy.com/dapi/order/details?order_id=${orderId}`, {
      credentials: 'include',
      headers: { '__fetch_req__': 'true' },
    });
    const data = await response.json();
    return data?.data?.orders?.[0] || null;
  } catch {
    return null;
  }
}

function showBanner(text, type = 'info') {
  let banner = document.getElementById('nutriplan-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'nutriplan-banner';
    banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:999999;padding:12px 20px;font-family:-apple-system,sans-serif;font-size:14px;text-align:center;transition:all 0.3s;';
    document.body.prepend(banner);
  }

  const colors = {
    info: { bg: '#eff6ff', text: '#1e40af', border: '#bfdbfe' },
    success: { bg: '#f0fdf4', text: '#166534', border: '#bbf7d0' },
    error: { bg: '#fef2f2', text: '#991b1b', border: '#fecaca' },
  };
  const c = colors[type] || colors.info;
  banner.style.background = c.bg;
  banner.style.color = c.text;
  banner.style.borderBottom = `2px solid ${c.border}`;
  banner.textContent = `🥗 NutriPlan: ${text}`;
}
