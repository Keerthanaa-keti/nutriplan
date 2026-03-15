// NutriPlan Extension Popup Logic

const APP_URLS = {
  swiggy: 'https://www.swiggy.com/my-account/orders',
  zomato: 'https://www.zomato.com/users/orders',
  bigbasket: 'https://www.bigbasket.com/order/order-history/',
  blinkit: 'https://blinkit.com/orders',
  zepto: 'https://www.zepto.co/account/orders',
  swiggy_instamart: 'https://www.swiggy.com/my-account/orders',
};

document.addEventListener('DOMContentLoaded', async () => {
  // Check if configured
  const config = await chrome.storage.local.get(['appUrl', 'memberName', 'configured']);

  if (!config.configured) {
    document.getElementById('setup-view').style.display = 'block';
    document.getElementById('main-view').style.display = 'none';
  } else {
    document.getElementById('setup-view').style.display = 'none';
    document.getElementById('main-view').style.display = 'block';
    loadStats();
  }

  // Save config
  document.getElementById('save-config').addEventListener('click', async () => {
    const appUrl = document.getElementById('app-url').value.trim();
    const memberName = document.getElementById('member-name').value.trim();

    if (!appUrl || !memberName) return;

    await chrome.storage.local.set({
      appUrl,
      memberName,
      configured: true,
    });

    document.getElementById('setup-view').style.display = 'none';
    document.getElementById('main-view').style.display = 'block';
  });

  // Import buttons
  document.querySelectorAll('.app-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const app = btn.dataset.app;
      const type = btn.dataset.type;
      const statusEl = document.getElementById(`status-${app}`);

      statusEl.textContent = 'Opening...';
      statusEl.className = 'app-status status-importing';

      // Open the app's order history page
      const url = APP_URLS[app];
      if (url) {
        chrome.tabs.create({ url, active: true }, (tab) => {
          // Store which app we're importing from
          chrome.storage.local.set({
            activeImport: { app, type, tabId: tab.id },
          });

          // The content script on that page will handle the import
          statusEl.textContent = 'Importing...';
        });
      }
    });
  });

  // Listen for import completion messages
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'IMPORT_COMPLETE') {
      const statusEl = document.getElementById(`status-${msg.app}`);
      if (statusEl) {
        statusEl.textContent = `${msg.count} orders`;
        statusEl.className = 'app-status status-done';
      }
      loadStats();
    } else if (msg.type === 'IMPORT_ERROR') {
      const statusEl = document.getElementById(`status-${msg.app}`);
      if (statusEl) {
        statusEl.textContent = 'Error';
        statusEl.className = 'app-status status-error';
      }
    }
  });
});

async function loadStats() {
  const data = await chrome.storage.local.get(['importStats']);
  const stats = data.importStats || { orders: 0, items: 0 };
  document.getElementById('total-orders').textContent = stats.orders;
  document.getElementById('total-items').textContent = stats.items;
}
