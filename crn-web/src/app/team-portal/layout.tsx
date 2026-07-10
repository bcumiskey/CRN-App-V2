"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { HardHat, Sun, CalendarDays, Wallet } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/team-portal", label: "Today", icon: Sun },
  { href: "/team-portal/schedule", label: "Schedule", icon: CalendarDays },
  { href: "/team-portal/pay", label: "Pay", icon: Wallet },
];

export default function TeamPortalLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="p-6 max-w-4xl">
      {/* Preview banner — visible on every portal page */}
      <div className="mb-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
        <HardHat size={18} className="text-amber-600 mt-0.5 shrink-0" />
        <p className="text-sm text-amber-800">
          Team Portal preview — per-cleaner logins arrive with full auth; today
          this shows the admin&apos;s view.
        </p>
      </div>

      <PageHeader title="Team Portal" subtitle="The worker view, inside the admin app" />

      {/* Section tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive =
            tab.href === "/team-portal"
              ? pathname === "/team-portal"
              : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex items-center gap-2 px-4 py-2 -mb-px border-b-2 text-sm font-medium transition-colors",
                isActive
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              )}
            >
              <Icon size={16} />
              {tab.label}
            </Link>
          );
        })}
      </div>

      {children}
    </div>
  );
}
