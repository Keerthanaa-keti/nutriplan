// NutriPlan - Zepto Order Importer

(async function () {
  if (!window.location.href.includes('zepto.co')) return;

  const config = await chrome.storage.local.get(['activeImport', 'memberName']);
  if (!config.activeImport || config.activeImport.app !== 'zepto') return;

  console.log('[NutriPlan] Zepto importer active');
  showBanner('Importing Zepto orders...');

  try {
    const orders = await fetchZeptoOrders();

    if (orders.length === 0) {
      showBanner('No orders found. Make sure you are logged into Zepto.', 'error');
      return;
    }

    const normalized = orders.map(order => ({
      platform_order_id: order.id?.toString(),
      restaurant_name: 'Zepto',
      order_date: order.created_at || order.placed_at,
      total_amount: parseFloat(order.total_amount || order.total || 0),
      items: (order.items || order.line_items || []).map(item => ({
        name: item.name || item.product_name || '',
        quantity: item.quantity || 1,
        price: parseFloat(item.price || item.selling_price || 0),
        is_veg: true,
        category: item.category || 'grocery',
        brand: item.brand || '',
      })),
    }));

    chrome.runtime.sendMessage({
      type: 'SEND_TO_NUTRIPLAN',
      data: {
        platform: 'zepto',
        member_name: config.memberName,
        order_type: 'grocery',
        orders: normalized,
        imported_at: new Date().toISOString(),
      },
    });

    showBanner(`Successfully imported ${orders.length} Zepto orders!`, 'success');
    await chrome.storage.local.remove('activeImport');
  } catch (err) {
    console.error('[NutriPlan] Zepto import error:', err);
    showBanner(`Import error: ${err.message}`, 'error');
  }
})();

async function fetchZeptoOrders() {
  const allOrders = [];
  let page = 1;
  let hasMore = true;

  while (hasMore && page <= 20) {
    try {
      const response = await fetch(`https://api.zepto.co/api/v2/order/history?page=${page}`, {
        credentials: 'include',
      });
      const data = await response.json();
      const orders = data?.orders || data?.data || [];

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
