"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Car, Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCurrency, formatDate } from "@/lib/utils";

interface MileageEntry {
  id: string;
  date: string;
  fromLocation: string;
  toLocation: string;
  miles: number;
  deduction: number;
}

interface MileageSummary {
  totalMiles: number;
  totalDeduction: number;
  rate: number;
}

export default function MileagePage() {
  const [entries, setEntries] = useState<MileageEntry[]>([]);
  const [summary, setSummary] = useState<MileageSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  // Form state
  const [formDate, setFormDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [formFrom, setFormFrom] = useState("");
  const [formTo, setFormTo] = useState("");
  const [formMiles, setFormMiles] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      api.get<{ entries: MileageEntry[] }>("/mileage"),
      api.get<MileageSummary>("/mileage/summary"),
    ])
      .then(([mileData, sumData]) => {
        setEntries(mileData.entries);
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
      await api.post("/mileage", {
        date: formDate,
        fromLocation: formFrom,
        toLocation: formTo,
        miles: parseFloat(formMiles),
      });
      setShowModal(false);
      setFormFrom("");
      setFormTo("");
      setFormMiles("");
      fetchData();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl">
      <PageHeader
        title="Mileage"
        subtitle="Track business mileage for tax deductions"
        actions={
          <Button variant="primary" onClick={() => setShowModal(true)}>
            <Plus size={16} />
            Add Trip
          </Button>
        }
      />

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="p-5">
              <p className="text-2xl font-bold text-gray-900">{summary.totalMiles.toFixed(1)}</p>
              <p className="text-sm text-gray-500">Total Miles</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-2xl font-bold text-green-700">{formatCurrency(summary.totalDeduction)}</p>
              <p className="text-sm text-gray-500">Total Deduction</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(summary.rate)}</p>
              <p className="text-sm text-gray-500">Rate / Mile</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Table */}
      <Card>
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Loading...</div>
        ) : entries.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={<Car size={40} />}
              title="No mileage entries"
            />
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Date</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Route</th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Miles</th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Deduction</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {entries.map((entry) => (
                <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-sm text-gray-600">{formatDate(entry.date)}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {entry.fromLocation} <span className="text-gray-400 mx-1">&rarr;</span> {entry.toLocation}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900 text-right">{entry.miles.toFixed(1)}</td>
                  <td className="px-6 py-4 text-sm font-semibold text-green-700 text-right">{formatCurrency(entry.deduction)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* Add Trip Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Add Trip">
        <div className="space-y-4">
          <Input
            label="Date"
            type="date"
            value={formDate}
            onChange={(e) => setFormDate(e.target.value)}
          />
          <Input
            label="From"
            type="text"
            value={formFrom}
            onChange={(e) => setFormFrom(e.target.value)}
            placeholder="Starting location"
          />
          <Input
            label="To"
            type="text"
            value={formTo}
            onChange={(e) => setFormTo(e.target.value)}
            placeholder="Destination"
          />
          <Input
            label="Miles"
            type="number"
            step="0.1"
            value={formMiles}
            onChange={(e) => setFormMiles(e.target.value)}
            placeholder="0.0"
          />
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              className="flex-1"
              onClick={handleAdd}
              disabled={saving || !formFrom || !formTo || !formMiles}
              loading={saving}
            >
              Add Trip
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
