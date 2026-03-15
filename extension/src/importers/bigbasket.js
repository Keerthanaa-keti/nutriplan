// NutriPlan - BigBasket Order Importer

(async function () {
  if (!window.location.href.includes('bigbasket.com')) return;

  const config = await chrome.storage.local.get(['activeImport', 'memberName']);
  if (!config.activeImport || config.activeImport.app !== 'bigbasket') return;

  console.log('[NutriPlan] BigBasket importer active');
  showBanner('Importing BigBasket orders...');

  try {
    const orders = await fetchBigBasketOrders();

    if (orders.length === 0) {
      showBanner('No orders found. Make sure you are logged into BigBasket.', 'error');
      return;
    }

    const normalized = orders.map(order => ({
      platform_order_id: order.order_number || order.id?.toString(),
      restaurant_name: 'BigBasket',
      order_date: order.created_on || order.order_date,
      total_amount: parseFloat(order.total || order.order_total || 0),
      items: (order.items || order.order_items || []).map(item => ({
        name: item.desc || item.product_name || item.name || '',
        quantity: item.qty || item.quantity || 1,
        price: parseFloat(item.sp || item.sale_price || item.price || 0),
        is_veg: true, // BigBasket items are mostly grocery
        category: item.tlc_name || item.category || 'grocery',
        brand: item.brand || '',
        weight: item.w || item.weight || '',
        unit: item.unit || '',
      })),
    }));

    chrome.runtime.sendMessage({
      type: 'SEND_TO_NUTRIPLAN',
      data: {
        platform: 'bigbasket',
        member_name: config.memberName,
        order_type: 'grocery',
        orders: normalized,
        imported_at: new Date().toISOString(),
      },
    });

    showBanner(`Successfully imported ${orders.length} BigBasket orders!`, 'success');
    await chrome.storage.local.remove('activeImport');
  } catch (err) {
    console.error('[NutriPlan] BigBasket import error:', err);
    showBanner(`Import error: ${err.message}`, 'error');
  }
})();

async function fetchBigBasketOrders() {
  const allOrders = [];
  let page = 1;
  let hasMore = true;

  while (hasMore && page <= 20) {
    try {
      const response = await fetch(`https://www.bigbasket.com/mapi/v3.1.0/order/past-orders/?page=${page}`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json();
      const orders = data?.orders || data?.data?.orders || [];

      if (orders.length === 0) { hasMore = false; }
      else { allOrders.push(...orders); page++; await new Promise(r => setTimeout(r, 500)); }
    } catch { hasMore = false; }
  }
  return allOrders;
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
