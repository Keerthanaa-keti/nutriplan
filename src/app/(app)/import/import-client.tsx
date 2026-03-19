'use client';

import { useState, useEffect } from 'react';

const EXTENSION_ID = ''; // Will be auto-detected

const PLATFORMS = [
  { id: 'swiggy', name: 'Swiggy', desc: 'Food orders & Instamart', color: '#fc8019', type: 'food_delivery', url: 'https://www.swiggy.com/my-account/orders' },
  { id: 'zomato', name: 'Zomato', desc: 'Food delivery orders', color: '#e23744', type: 'food_delivery', url: 'https://www.zomato.com/users/orders' },
  { id: 'bigbasket', name: 'BigBasket', desc: 'Grocery orders', color: '#84c225', type: 'grocery', url: 'https://www.bigbasket.com/order/order-history/' },
  { id: 'blinkit', name: 'Blinkit', desc: 'Grocery orders', color: '#f8cb46', type: 'grocery', url: 'https://blinkit.com/orders' },
  { id: 'zepto', name: 'Zepto', desc: 'Grocery orders', color: '#7b2d8e', type: 'grocery', url: 'https://www.zepto.co/account/orders' },
] as const;

type Status = 'idle' | 'opening' | 'importing' | 'done' | 'error';

interface Props {
  userName: string;
  importCounts: Record<string, number>;
  totalOrders: number;
}

export default function ImportClient({ userName, importCounts, totalOrders }: Props) {
  const [extensionDetected, setExtensionDetected] = useState<boolean | null>(null);
  const [statuses, setStatuses] = useState<Record<string, Status>>({});
  const [messages, setMessages] = useState<Record<string, string>>({});

  // Try to detect extension on mount
  useEffect(() => {
    detectExtension();
  }, []);

  async function detectExtension() {
    // Try known extension ID first, then fall back
    try {
      // Check if extension injected a marker
      const marker = document.getElementById('nutriplan-ext-marker');
      if (marker) {
        setExtensionDetected(true);
        return;
      }
      // Try to ping via externally_connectable (need extension ID)
      // For now, we'll check localStorage for a flag the extension sets
      const extFlag = localStorage.getItem('nutriplan-extension');
      if (extFlag) {
        setExtensionDetected(true);
        return;
      }
      setExtensionDetected(false);
    } catch {
      setExtensionDetected(false);
    }
  }

  function handleImport(platformId: string) {
    const platform = PLATFORMS.find(p => p.id === platformId);
    if (!platform) return;

    setStatuses(s => ({ ...s, [platformId]: 'opening' }));
    setMessages(m => ({ ...m, [platformId]: 'Opening orders page...' }));

    // Open the platform's orders page in a new tab
    // The extension's content script will auto-run and import
    window.open(platform.url, '_blank');

    setStatuses(s => ({ ...s, [platformId]: 'importing' }));
    setMessages(m => ({ ...m, [platformId]: 'Log in if needed, extension will import automatically' }));

    // Reset status after 30s
    setTimeout(() => {
      setStatuses(s => {
        if (s[platformId] === 'importing') return { ...s, [platformId]: 'idle' };
        return s;
      });
      setMessages(m => {
        if (statuses[platformId] === 'importing') return { ...m, [platformId]: '' };
        return m;
      });
    }, 30000);
  }

  function handleManualOpen(url: string) {
    window.open(url, '_blank');
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Import Orders</h1>
        <p className="text-gray-500 text-sm mt-1">
          Pull your food & grocery history to build your nutrition profile.
        </p>
      </div>

      {/* Extension status */}
      <div className={`rounded-lg p-4 border ${extensionDetected ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
        {extensionDetected ? (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-sm font-medium text-green-800">Extension connected</span>
            <span className="text-xs text-green-600 ml-auto">{totalOrders} orders imported</span>
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-sm font-medium text-amber-800">Extension not detected</span>
            </div>
            <p className="text-xs text-amber-700 mb-3">Install the NutriPlan Chrome extension to auto-import your orders.</p>
            <div className="flex gap-2">
              <button
                onClick={() => window.open('chrome://extensions', '_blank')}
                className="text-xs bg-amber-800 text-white px-3 py-1.5 rounded-md hover:bg-amber-900"
              >
                Open Extensions Page
              </button>
              <span className="text-xs text-amber-600 self-center">
                → Enable Developer mode → Load unpacked → Select <code className="bg-amber-100 px-1 rounded">extension/</code> folder
              </span>
            </div>
          </div>
        )}
      </div>

      {/* How it works - compact */}
      <div className="flex gap-4 text-xs text-gray-500">
        <div className="flex items-center gap-1.5">
          <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center text-[10px] font-bold">1</span>
          Click a platform below
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center text-[10px] font-bold">2</span>
          Log in if needed
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center text-[10px] font-bold">3</span>
          Extension imports automatically
        </div>
      </div>

      {/* Platform cards */}
      <div className="space-y-2">
        {PLATFORMS.map((p) => {
          const status = statuses[p.id] || 'idle';
          const count = importCounts[p.id] || 0;
          const message = messages[p.id] || '';

          return (
            <div
              key={p.id}
              className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer group"
              onClick={() => extensionDetected ? handleImport(p.id) : handleManualOpen(p.url)}
            >
              <div className="flex items-center gap-3">
                {/* Platform icon */}
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0"
                  style={{ background: p.color }}
                >
                  {p.name[0]}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{p.name}</span>
                    <span className="text-xs text-gray-400">{p.desc}</span>
                  </div>

                  {/* Status line */}
                  {status === 'idle' && count > 0 && (
                    <p className="text-xs text-green-600 mt-0.5">{count} orders imported</p>
                  )}
                  {status === 'idle' && count === 0 && (
                    <p className="text-xs text-gray-400 mt-0.5">No orders yet — click to import</p>
                  )}
                  {status === 'opening' && (
                    <p className="text-xs text-blue-600 mt-0.5 animate-pulse">Opening...</p>
                  )}
                  {status === 'importing' && (
                    <p className="text-xs text-blue-600 mt-0.5 animate-pulse">{message}</p>
                  )}
                  {status === 'done' && (
                    <p className="text-xs text-green-600 mt-0.5">{message}</p>
                  )}
                  {status === 'error' && (
                    <p className="text-xs text-red-600 mt-0.5">{message}</p>
                  )}
                </div>

                {/* Action */}
                <div className="shrink-0">
                  {status === 'importing' ? (
                    <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg className="w-5 h-5 text-gray-300 group-hover:text-gray-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary if any imports exist */}
      {totalOrders > 0 && (
        <div className="bg-gray-50 rounded-lg p-4 border">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Total imported</span>
            <span className="font-medium">{totalOrders} orders</span>
          </div>
          <div className="flex gap-2 mt-2 flex-wrap">
            {Object.entries(importCounts).map(([platform, count]) => (
              <span key={platform} className="text-xs bg-white border rounded-full px-2 py-0.5">
                {platform}: {count}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Without extension fallback */}
      {!extensionDetected && (
        <div className="text-xs text-gray-400 border-t pt-4">
          <p className="font-medium text-gray-500 mb-1">Without the extension?</p>
          <p>You can still click each platform to open your orders page. The extension auto-reads your order history — without it, you&apos;d need to use the extension popup to trigger imports.</p>
        </div>
      )}
    </div>
  );
}
