'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { LayoutDashboard, CalendarDays, Database, ShoppingCart, PackageOpen, Settings, LogOut, TableProperties, Utensils, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/master-db', label: 'Master Database', icon: TableProperties },
  { href: '/meal-plan', label: 'Weekly Plan', icon: CalendarDays },
  { href: '/grocery', label: 'Grocery Days', icon: ShoppingCart },
  { href: '/restaurants', label: 'Restaurant Food', icon: Utensils },
  { href: '/pantry', label: 'Pantry', icon: PackageOpen },
  { href: '/food-database', label: 'Nutrition Ref', icon: Database },
  { href: '/settings', label: 'Settings', icon: Settings },
];

const bottomNavItems = [
  { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { href: '/meal-plan', label: 'Plan', icon: CalendarDays },
  { href: '/grocery', label: 'Grocery', icon: ShoppingCart },
  { href: '/master-db', label: 'Database', icon: TableProperties },
];

export function SidebarNav({ userName }: { userName: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 bg-white border-r border-gray-200 flex-col shrink-0">
        <div className="p-6">
          <Link href="/dashboard">
            <h1 className="text-xl font-bold text-green-800">NutriPlan</h1>
          </Link>
          <p className="text-sm text-gray-500 mt-1 truncate">{userName}</p>
        </div>
        <Separator />
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-green-50 text-green-800 font-medium'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4">
          <Button variant="ghost" className="w-full justify-start text-gray-500" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            Log out
          </Button>
        </div>
      </aside>

      {/* Mobile Top Bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <Link href="/dashboard">
          <h1 className="text-lg font-bold text-green-800">NutriPlan</h1>
        </Link>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          {mobileMenuOpen ? (
            <X className="h-5 w-5 text-gray-600" />
          ) : (
            <Menu className="h-5 w-5 text-gray-600" />
          )}
        </button>
      </div>

      {/* Mobile Slide-down Menu */}
      {mobileMenuOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 bg-black/20 z-40"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="md:hidden fixed top-[57px] left-0 right-0 z-50 bg-white border-b border-gray-200 shadow-lg max-h-[70vh] overflow-y-auto">
            <div className="px-4 py-2 text-sm text-gray-500 truncate border-b border-gray-100">
              {userName}
            </div>
            <nav className="p-2 space-y-0.5">
              {navItems.map((item) => {
                const isActive = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                      isActive
                        ? 'bg-green-50 text-green-800 font-medium'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <div className="p-2 border-t border-gray-100">
              <Button
                variant="ghost"
                className="w-full justify-start text-gray-500"
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleLogout();
                }}
              >
                <LogOut className="h-4 w-4 mr-2" />
                Log out
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 px-2 py-1 safe-area-bottom">
        <div className="flex justify-around">
          {bottomNavItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg text-[10px] transition-colors min-w-[60px] ${
                  isActive
                    ? 'text-green-700 font-semibold'
                    : 'text-gray-400'
                }`}
              >
                <item.icon className={`h-5 w-5 ${isActive ? 'text-green-700' : 'text-gray-400'}`} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}
