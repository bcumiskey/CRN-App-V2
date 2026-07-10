"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Receipt, Plus, Paperclip } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCurrency, formatDate } from "@/lib/utils";

interface ExpenseCategory {
  id: string;
  name: string;
  code: string;
}

interface Expense {
  id: string;
  date: string;
  vendor?: string | null;
  category: ExpenseCategory;
  description?: string | null;
  amount: number;
  receiptUrl?: string | null;
}

interface ExpenseSummary {
  startDate: string;
  endDate: string;
  total: number;
  totalDeductible: number;
  byCategory: { categoryName: string; total: number }[];
}

type RangePreset = "this_month" | "last_month" | "this_year";

const RANGE_OPTIONS: { value: RangePreset; label: string }[] = [
  { value: "this_month", label: "This Month" },
  { value: "last_month", label: "Last Month" },
  { value: "this_year", label: "This Year" },
];

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function todayLocalYMD(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

function rangeForPreset(preset: RangePreset): { startDate: string; endDate: string } {
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth() + 1; // 1-based

  if (preset === "this_year") {
    return { startDate: `${year}-01-01`, endDate: `${year}-12-31` };
  }

  if (preset === "last_month") {
    month -= 1;
    if (month === 0) {
      month = 12;
      year -= 1;
    }
  }

  const lastDay = new Date(year, month, 0).getDate();
  return {
    startDate: `${year}-${pad2(month)}-01`,
    endDate: `${year}-${pad2(month)}-${pad2(lastDay)}`,
  };
}

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expenseCount, setExpenseCount] = useState(0);
  const [summary, setSummary] = useState<ExpenseSummary | null>(null);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [rangePreset, setRangePreset] = useState<RangePreset>("this_month");

  // Form state
  const [formDate, setFormDate] = useState(() => todayLocalYMD());
  const [formVendor, setFormVendor] = useState("");
  const [formCategoryId, setFormCategoryId] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchData = (preset: RangePreset) => {
    setLoading(true);
    const { startDate, endDate } = rangeForPreset(preset);
    Promise.all([
      api.get<{ expenses: Expense[]; total: number }>("/expenses", { startDate, endDate, limit: 200 }),
      api.get<ExpenseSummary>("/expenses/summary", { startDate, endDate }),
    ])
      .then(([expData, sumData]) => {
        setExpenses(expData.expenses);
        setExpenseCount(expData.total);
        setSummary(sumData);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData(rangePreset);
  }, [rangePreset]);

  useEffect(() => {
    api
      .get<{ categories: ExpenseCategory[] }>("/expenses/categories")
      .then((data) => {
        setCategories(data.categories);
        if (data.categories.length > 0) {
          setFormCategoryId((prev) => prev || data.categories[0].id);
        }
      })
      .catch(console.error);
  }, []);

  const handleAdd = async () => {
    setSaving(true);
    setFormError(null);
    try {
      await api.post("/expenses", {
        date: formDate,
        vendor: formVendor || undefined,
        categoryId: formCategoryId,
        description: formDescription || undefined,
        amount: parseFloat(formAmount),
      });
      setShowModal(false);
      setFormVendor("");
      setFormDescription("");
      setFormAmount("");
      fetchData(rangePreset);
    } catch (err) {
      console.error(err);
      setFormError("Failed to save expense. Please check the fields and try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl">
      <PageHeader
        title="Expenses"
        subtitle="Track business expenses"
        actions={
          <div className="flex items-center gap-3">
            <select
              value={rangePreset}
              onChange={(e) => setRangePreset(e.target.value as RangePreset)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            >
              {RANGE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <Button variant="primary" onClick={() => { setFormError(null); setShowModal(true); }}>
              <Plus size={16} />
              Add Expense
            </Button>
          </div>
        }
      />

      {/* Summary Card */}
      {summary && (
        <Card className="mb-6">
          <CardContent>
            <div className="flex items-center gap-6">
              <div>
                <p className="text-3xl font-bold text-gray-900">{formatCurrency(summary.total)}</p>
                <p className="text-sm text-gray-500">Total Expenses</p>
              </div>
              <div className="border-l border-gray-200 pl-6">
                <p className="text-xl font-semibold text-gray-900">{formatCurrency(summary.totalDeductible)}</p>
                <p className="text-sm text-gray-500">Deductible</p>
              </div>
              <div className="border-l border-gray-200 pl-6">
                <p className="text-xl font-semibold text-gray-900">{expenseCount}</p>
                <p className="text-sm text-gray-500">Entries</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <Card>
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Loading...</div>
        ) : expenses.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={<Receipt size={40} />}
              title="No expenses yet"
            />
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Date</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Vendor</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Category</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Description</th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Amount</th>
                <th className="text-center text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {expenses.map((exp) => (
                <tr key={exp.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-sm text-gray-600">{formatDate(exp.date)}</td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{exp.vendor || "-"}</td>
                  <td className="px-6 py-4">
                    <Badge>{exp.category?.name ?? "Uncategorized"}</Badge>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{exp.description || "-"}</td>
                  <td className="px-6 py-4 text-sm font-semibold text-gray-900 text-right">{formatCurrency(exp.amount)}</td>
                  <td className="px-6 py-4 text-center">
                    {exp.receiptUrl && <Paperclip size={14} className="text-blue-500 mx-auto" />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* Add Expense Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Add Expense">
        <div className="space-y-4">
          <Input
            label="Date"
            type="date"
            value={formDate}
            onChange={(e) => setFormDate(e.target.value)}
          />
          <Input
            label="Vendor"
            type="text"
            value={formVendor}
            onChange={(e) => setFormVendor(e.target.value)}
            placeholder="e.g. Walmart, Home Depot"
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select
              value={formCategoryId}
              onChange={(e) => setFormCategoryId(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            >
              {categories.length === 0 && <option value="">Loading categories...</option>}
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>
          <Input
            label="Description (optional)"
            type="text"
            value={formDescription}
            onChange={(e) => setFormDescription(e.target.value)}
          />
          <Input
            label="Amount ($)"
            type="number"
            step="0.01"
            value={formAmount}
            onChange={(e) => setFormAmount(e.target.value)}
            placeholder="0.00"
          />
          {formError && (
            <p className="text-sm text-red-600">{formError}</p>
          )}
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              className="flex-1"
              onClick={handleAdd}
              disabled={saving || !formVendor || !formAmount || !formCategoryId}
              loading={saving}
            >
              Add Expense
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
