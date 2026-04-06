"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Calendar,
  ClipboardList,
  Building,
  Users,
  FileText,
  Receipt,
  TrendingUp,
  Package,
  Wallet,
  Settings,
  Car,
  RefreshCw,
  UserCircle,
  StickyNote,
  DollarSign,
} from "lucide-react";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/jobs", label: "Jobs & Payments", icon: DollarSign },
  { href: "/owners", label: "Owners", icon: UserCircle },
  { href: "/properties", label: "Properties", icon: Building },
  { href: "/team", label: "Team", icon: Users },
  { href: "/linens", label: "Linens & Supplies", icon: Package },
  { href: "/invoices", label: "Invoicing", icon: FileText },
  { href: "/notes", label: "Notes", icon: StickyNote },
  { href: "/reports", label: "Reports", icon: TrendingUp },
];

const secondaryItems = [
  { href: "/calendar-sync", label: "Calendar Sync", icon: RefreshCw },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-gray-900 text-gray-300 flex flex-col min-h-screen sticky top-0">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-gray-800">
        <h1 className="text-lg font-semibold text-white tracking-tight">Clean Right Now</h1>
        <p className="text-xs text-gray-500 mt-0.5">V2</p>
      </div>

      {/* Quick Add */}
      <div className="px-4 py-3">
        <Link
          href="/jobs/new"
          className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <span className="text-lg">+</span> Quick Add Job
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-blue-600 text-white"
                  : "text-gray-400 hover:text-white hover:bg-gray-800"
              }`}
            >
              <Icon size={18} />
              {item.label}
            </Link>
          );
        })}

        <div className="border-t border-gray-800 my-3" />

        {secondaryItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-blue-600 text-white"
                  : "text-gray-400 hover:text-white hover:bg-gray-800"
              }`}
            >
              <Icon size={18} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="px-4 py-4 border-t border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-semibold">
            A
          </div>
          <div>
            <p className="text-sm font-medium text-white">Alex</p>
            <p className="text-xs text-gray-500">Admin</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
