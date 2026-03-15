// NutriPlan - Blinkit Order Importer

(async function () {
  if (!window.location.href.includes('blinkit.com')) return;

  const config = await chrome.storage.local.get(['activeImport', 'memberName']);
  if (!config.activeImport || config.activeImport.app !== 'blinkit') return;

  console.log('[NutriPlan] Blinkit importer active');
  showBanner('Importing Blinkit orders...');

  try {
    const orders = await fetchBlinkitOrders();

    if (orders.length === 0) {
      showBanner('No orders found. Make sure you are logged into Blinkit.', 'error');
      return;
    }

    const normalized = orders.map(order => ({
      platform_order_id: order.id?.toString() || order.order_id?.toString(),
      restaurant_name: 'Blinkit',
      order_date: order.created_at || order.order_date,
      total_amount: parseFloat(order.total || order.bill_total || 0),
      items: (order.items || order.products || []).map(item => ({
        name: item.name || item.product_name || '',
        quantity: item.quantity || 1,
        price: parseFloat(item.price || item.mrp || 0),
        is_veg: true,
        category: item.category || 'grocery',
        brand: item.brand || '',
        weight: item.unit_info || '',
      })),
    }));

    chrome.runtime.sendMessage({
      type: 'SEND_TO_NUTRIPLAN',
      data: {
        platform: 'blinkit',
        member_name: config.memberName,
        order_type: 'grocery',
        orders: normalized,
        imported_at: new Date().toISOString(),
      },
    });

    showBanner(`Successfully imported ${orders.length} Blinkit orders!`, 'success');
    await chrome.storage.local.remove('activeImport');
  } catch (err) {
    console.error('[NutriPlan] Blinkit import error:', err);
    showBanner(`Import error: ${err.message}`, 'error');
  }
})();

async function fetchBlinkitOrders() {
  const allOrders = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore && offset < 500) {
    try {
      const response = await fetch(`https://blinkit.com/v2/order/history?offset=${offset}&limit=20`, {
        credentials: 'include',
      });
      const data = await response.json();
      const orders = data?.orders || [];

      if (orders.length === 0) { hasMore = false; }
      else { allOrders.push(...orders); offset += 20; await new Promise(r => setTimeout(r, 500)); }
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
