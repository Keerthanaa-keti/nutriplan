'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { LayoutDashboard, CalendarDays, Database, ShoppingCart, PackageOpen, Settings, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/meal-plan', label: 'Meal Plan', icon: CalendarDays },
  { href: '/food-database', label: 'Food Database', icon: Database },
  { href: '/grocery', label: 'Grocery List', icon: ShoppingCart },
  { href: '/pantry', label: 'Pantry', icon: PackageOpen },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function SidebarNav({ userName }: { userName: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
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
  );
}
