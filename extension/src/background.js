// NutriPlan Extension Background Service Worker

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SEND_TO_NUTRIPLAN') {
    forwardToApp(message.data).then(sendResponse);
    return true;
  }
  if (message.type === 'PING') {
    sendResponse({ status: 'ok', version: chrome.runtime.getManifest().version });
    return true;
  }
});

// Handle messages from the web app (externally_connectable)
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  if (message.type === 'PING') {
    sendResponse({ status: 'ok', version: chrome.runtime.getManifest().version });
    return true;
  }
  if (message.type === 'START_IMPORT') {
    const { app, type, memberName } = message;
    const APP_URLS = {
      swiggy: 'https://www.swiggy.com/my-account/orders',
      zomato: 'https://www.zomato.com/users/orders',
      bigbasket: 'https://www.bigbasket.com/order/order-history/',
      blinkit: 'https://blinkit.com/orders',
      zepto: 'https://www.zepto.co/account/orders',
    };

    const url = APP_URLS[app];
    if (!url) {
      sendResponse({ success: false, error: 'Unknown platform' });
      return true;
    }

    // Store config and open the platform tab
    chrome.storage.local.set({
      activeImport: { app, type },
      memberName: memberName || '',
      appUrl: sender.origin || 'http://localhost:3000',
      configured: true,
    }).then(() => {
      chrome.tabs.create({ url, active: true }, (tab) => {
        sendResponse({ success: true, tabId: tab.id });
      });
    });
    return true;
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
