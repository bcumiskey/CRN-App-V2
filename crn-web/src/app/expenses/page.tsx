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

interface Expense {
  id: string;
  date: string;
  vendor: string;
  category: string;
  description?: string;
  amount: number;
  hasReceipt: boolean;
}

interface ExpenseSummary {
  totalAmount: number;
  count: number;
  byCategory: Record<string, number>;
}

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [summary, setSummary] = useState<ExpenseSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  // Form state
  const [formDate, setFormDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [formVendor, setFormVendor] = useState("");
  const [formCategory, setFormCategory] = useState("Supplies");
  const [formDescription, setFormDescription] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      api.get<{ expenses: Expense[] }>("/expenses"),
      api.get<ExpenseSummary>("/expenses/summary"),
    ])
      .then(([expData, sumData]) => {
        setExpenses(expData.expenses);
        setSummary(sumData);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAdd = async () => {
    setSaving(true);
    try {
      await api.post("/expenses", {
        date: formDate,
        vendor: formVendor,
        category: formCategory,
        description: formDescription || undefined,
        amount: parseFloat(formAmount),
      });
      setShowModal(false);
      setFormVendor("");
      setFormDescription("");
      setFormAmount("");
      fetchData();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const categories = ["Supplies", "Equipment", "Transportation", "Insurance", "Marketing", "Office", "Other"];

  return (
    <div className="p-6 max-w-6xl">
      <PageHeader
        title="Expenses"
        subtitle="Track business expenses"
        actions={
          <Button variant="primary" onClick={() => setShowModal(true)}>
            <Plus size={16} />
            Add Expense
          </Button>
        }
      />

      {/* Summary Card */}
      {summary && (
        <Card className="mb-6">
          <CardContent>
            <div className="flex items-center gap-6">
              <div>
                <p className="text-3xl font-bold text-gray-900">{formatCurrency(summary.totalAmount)}</p>
                <p className="text-sm text-gray-500">Total Expenses</p>
              </div>
              <div className="border-l border-gray-200 pl-6">
                <p className="text-xl font-semibold text-gray-900">{summary.count}</p>
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
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{exp.vendor}</td>
                  <td className="px-6 py-4">
                    <Badge>{exp.category}</Badge>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{exp.description || "-"}</td>
                  <td className="px-6 py-4 text-sm font-semibold text-gray-900 text-right">{formatCurrency(exp.amount)}</td>
                  <td className="px-6 py-4 text-center">
                    {exp.hasReceipt && <Paperclip size={14} className="text-blue-500 mx-auto" />}
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
              value={formCategory}
              onChange={(e) => setFormCategory(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
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
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              className="flex-1"
              onClick={handleAdd}
              disabled={saving || !formVendor || !formAmount}
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
