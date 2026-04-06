"use client";

import Link from "next/link";
import {
  DollarSign,
  TrendingUp,
  Users,
  Building,
  Calendar,
  Receipt,
  Car,
  PieChart,
  FileText,
  BarChart3,
} from "lucide-react";

const reportCategories = [
  {
    title: "Revenue",
    items: [
      { label: "Revenue Summary", description: "Total revenue, fees, and house cuts by period", icon: DollarSign, href: "/reports/revenue" },
      { label: "Revenue by Property", description: "Breakdown of revenue per property", icon: Building, href: "/reports/revenue-by-property" },
      { label: "Revenue by Month", description: "Monthly revenue trends and comparisons", icon: BarChart3, href: "/reports/revenue-by-month" },
    ],
  },
  {
    title: "Jobs",
    items: [
      { label: "Job Summary", description: "Job counts, types, and completion rates", icon: FileText, href: "/reports/jobs" },
      { label: "Jobs by Property", description: "Job frequency and revenue per property", icon: Building, href: "/reports/jobs-by-property" },
      { label: "Jobs by Crew", description: "Assignments and earnings per team member", icon: Users, href: "/reports/jobs-by-crew" },
    ],
  },
  {
    title: "Financial",
    items: [
      { label: "Profit & Loss", description: "Revenue minus expenses for any period", icon: TrendingUp, href: "/reports/profit-loss" },
      { label: "Expense Summary", description: "Expenses by category and vendor", icon: Receipt, href: "/reports/expenses" },
      { label: "Mileage Report", description: "Mileage log and tax deduction summary", icon: Car, href: "/reports/mileage" },
    ],
  },
  {
    title: "Team",
    items: [
      { label: "Pay Summary", description: "Worker earnings across pay periods", icon: Users, href: "/reports/pay-summary" },
      { label: "Worker Performance", description: "Jobs completed and revenue generated per worker", icon: PieChart, href: "/reports/worker-performance" },
    ],
  },
];

export default function ReportsPage() {
  return (
    <div className="p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <p className="text-sm text-gray-500 mt-1">Business insights and analytics</p>
      </div>

      <div className="space-y-8">
        {reportCategories.map((category) => (
          <div key={category.title}>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">{category.title}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {category.items.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:border-blue-200 hover:shadow-md transition-all group"
                  >
                    <div className="flex items-start gap-4">
                      <div className="p-2.5 bg-blue-50 rounded-lg group-hover:bg-blue-100 transition-colors">
                        <Icon size={20} className="text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors">
                          {item.label}
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">{item.description}</p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
