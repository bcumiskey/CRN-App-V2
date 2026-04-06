"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";
import { FileText } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCurrency, formatDate } from "@/lib/utils";

interface Invoice {
  id: string;
  invoiceNumber: string;
  date: string;
  dueDate?: string;
  ownerName: string;
  propertyName: string;
  type: string;
  status: string;
  totalAmount: number;
}

const tabs = [
  { label: "All", value: "" },
  { label: "Draft", value: "DRAFT" },
  { label: "Sent", value: "SENT" },
  { label: "Paid", value: "PAID" },
  { label: "Overdue", value: "OVERDUE" },
  { label: "Void", value: "VOID" },
];

export default function InvoicesPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("");

  useEffect(() => {
    setLoading(true);
    api
      .get<{ invoices: Invoice[] }>("/invoices", { status: activeTab || undefined })
      .then((data) => setInvoices(data.invoices))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [activeTab]);

  return (
    <div className="p-6 max-w-6xl">
      <PageHeader title="Invoices" subtitle="Manage billing and invoices" />

      {/* Filter Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === tab.value
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <Card>
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Loading...</div>
        ) : invoices.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={<FileText size={40} />}
              title="No invoices found"
            />
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Invoice #</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Date</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Owner</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Property</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Type</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Status</th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {invoices.map((inv) => (
                <tr
                  key={inv.id}
                  onClick={() => router.push(`/invoices/${inv.id}`)}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{inv.invoiceNumber}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{formatDate(inv.date)}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{inv.ownerName}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{inv.propertyName}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{inv.type}</td>
                  <td className="px-6 py-4">
                    <StatusBadge status={inv.status} />
                  </td>
                  <td className="px-6 py-4 text-sm font-semibold text-gray-900 text-right">{formatCurrency(inv.totalAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
