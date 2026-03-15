// NutriPlan Extension Background Service Worker

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SEND_TO_NUTRIPLAN') {
    // Forward imported data to NutriPlan app
    forwardToApp(message.data).then(sendResponse);
    return true; // async response
  }
});

async function forwardToApp(data) {
  const config = await chrome.storage.local.get(['appUrl']);
  const appUrl = config.appUrl || 'http://localhost:3000';

  try {
    const response = await fetch(`${appUrl}/api/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();

    // Update stats
    const stats = (await chrome.storage.local.get(['importStats'])).importStats || { orders: 0, items: 0 };
    stats.orders += data.orders?.length || 0;
    const itemSet = new Set();
    (data.orders || []).forEach(order => {
      (order.items || []).forEach(item => itemSet.add(item.name));
    });
    stats.items += itemSet.size;
    await chrome.storage.local.set({ importStats: stats });

    // Notify popup
    chrome.runtime.sendMessage({
      type: 'IMPORT_COMPLETE',
      app: data.platform,
      count: data.orders?.length || 0,
    });

    return { success: true, count: data.orders?.length || 0 };
  } catch (err) {
    chrome.runtime.sendMessage({
      type: 'IMPORT_ERROR',
      app: data.platform,
      error: err.message,
    });
    return { success: false, error: err.message };
  }
}
