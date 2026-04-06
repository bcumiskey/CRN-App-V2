"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Car, Plus, X } from "lucide-react";

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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mileage</h1>
          <p className="text-sm text-gray-500 mt-1">Track business mileage for tax deductions</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus size={16} />
          Add Trip
        </button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <p className="text-2xl font-bold text-gray-900">{summary.totalMiles.toFixed(1)}</p>
            <p className="text-sm text-gray-500">Total Miles</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <p className="text-2xl font-bold text-green-700">${summary.totalDeduction.toFixed(2)}</p>
            <p className="text-sm text-gray-500">Total Deduction</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <p className="text-2xl font-bold text-gray-900">${summary.rate}</p>
            <p className="text-sm text-gray-500">Rate / Mile</p>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Loading...</div>
        ) : entries.length === 0 ? (
          <div className="p-12 text-center">
            <Car size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">No mileage entries</p>
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
                  <td className="px-6 py-4 text-sm text-gray-600">{entry.date}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {entry.fromLocation} <span className="text-gray-400 mx-1">&rarr;</span> {entry.toLocation}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900 text-right">{entry.miles.toFixed(1)}</td>
                  <td className="px-6 py-4 text-sm font-semibold text-green-700 text-right">${entry.deduction.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Trip Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Add Trip</h2>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X size={18} className="text-gray-400" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
                <input
                  type="text"
                  value={formFrom}
                  onChange={(e) => setFormFrom(e.target.value)}
                  placeholder="Starting location"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
                <input
                  type="text"
                  value={formTo}
                  onChange={(e) => setFormTo(e.target.value)}
                  placeholder="Destination"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Miles</label>
                <input
                  type="number"
                  step="0.1"
                  value={formMiles}
                  onChange={(e) => setFormMiles(e.target.value)}
                  placeholder="0.0"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAdd}
                  disabled={saving || !formFrom || !formTo || !formMiles}
                  className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Add Trip"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
