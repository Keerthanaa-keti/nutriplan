// NutriPlan - Zomato Order Importer

(async function () {
  if (!window.location.href.includes('zomato.com')) return;

  const config = await chrome.storage.local.get(['activeImport', 'memberName']);
  if (!config.activeImport || config.activeImport.app !== 'zomato') return;

  console.log('[NutriPlan] Zomato importer active');
  showBanner('Importing Zomato orders...');

  try {
    const orders = await fetchZomatoOrders();

    if (orders.length === 0) {
      showBanner('No orders found. Make sure you are logged into Zomato.', 'error');
      return;
    }

    const normalized = orders.map(order => ({
      platform_order_id: order.id?.toString() || order.orderId?.toString(),
      restaurant_name: order.resInfo?.name || order.restaurant?.name || '',
      order_date: order.createdAt || order.orderDate,
      total_amount: parseFloat(order.totalCost || order.billing?.total || 0),
      items: (order.items || order.orderItems || []).map(item => ({
        name: item.name || item.itemName || '',
        quantity: item.quantity || 1,
        price: parseFloat(item.price || item.totalCost || 0),
        is_veg: item.isVeg === 1 || item.dietary === 'veg',
        category: '',
      })),
    }));

    chrome.runtime.sendMessage({
      type: 'SEND_TO_NUTRIPLAN',
      data: {
        platform: 'zomato',
        member_name: config.memberName,
        order_type: 'food_delivery',
        orders: normalized,
        imported_at: new Date().toISOString(),
      },
    });

    showBanner(`Successfully imported ${orders.length} Zomato orders!`, 'success');
    await chrome.storage.local.remove('activeImport');
  } catch (err) {
    console.error('[NutriPlan] Zomato import error:', err);
    showBanner(`Import error: ${err.message}`, 'error');
  }
})();

async function fetchZomatoOrders() {
  const allOrders = [];
  let page = 1;
  let hasMore = true;

  while (hasMore && page <= 20) {
    try {
      const response = await fetch(`https://www.zomato.com/webroutes/user/orders?page=${page}`, {
        credentials: 'include',
        headers: { 'x-zomato-csrft': getCsrfToken() },
      });
      const data = await response.json();
      const orders = data?.sections?.SECTION_USER_ORDER_HISTORY?.orders || data?.orders || [];

      if (orders.length === 0) { hasMore = false; }
      else { allOrders.push(...orders); page++; await new Promise(r => setTimeout(r, 500)); }
    } catch { hasMore = false; }
  }
  return allOrders;
}

function getCsrfToken() {
  const match = document.cookie.match(/csrf[=]([^;]+)/);
  return match ? match[1] : '';
}

function showBanner(text, type = 'info') {
  let banner = document.getElementById('nutriplan-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'nutriplan-banner';
    banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:999999;padding:12px 20px;font-family:-apple-system,sans-serif;font-size:14px;text-align:center;';
    document.body.prepend(banner);
  }
  const colors = { info: '#eff6ff', success: '#f0fdf4', error: '#fef2f2' };
  banner.style.background = colors[type] || colors.info;
  banner.textContent = `🥗 NutriPlan: ${text}`;
}
