"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Package, AlertCircle, CheckCircle, ShoppingCart } from "lucide-react";

interface SupplyItem {
  id: string;
  name: string;
  category?: string;
  onHand: number;
  reorderLevel: number;
  unit?: string;
  needsReorder: boolean;
  lastOrdered?: string;
}

export default function SuppliesPage() {
  const [items, setItems] = useState<SupplyItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<{ items: SupplyItem[] }>("/supplies")
      .then((data) => setItems(data.items))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const reorderCount = items.filter((i) => i.needsReorder).length;

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Supplies</h1>
          <p className="text-sm text-gray-500 mt-1">Track cleaning supply inventory</p>
        </div>
        {reorderCount > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-200 rounded-lg">
            <ShoppingCart size={14} className="text-red-600" />
            <span className="text-sm font-medium text-red-700">{reorderCount} item{reorderCount > 1 ? "s" : ""} need reorder</span>
          </div>
        )}
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">Loading...</p>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <Package size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">No supplies tracked</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
            <div
              key={item.id}
              className={`bg-white rounded-xl shadow-sm border p-5 ${
                item.needsReorder ? "border-red-200" : "border-gray-100"
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900">{item.name}</h3>
                  {item.category && <p className="text-xs text-gray-400 mt-0.5">{item.category}</p>}
                </div>
                {item.needsReorder ? (
                  <span className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                    <AlertCircle size={10} /> Reorder
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                    <CheckCircle size={10} /> Stocked
                  </span>
                )}
              </div>
              <div className="flex items-end gap-6">
                <div>
                  <p className={`text-2xl font-bold ${item.needsReorder ? "text-red-600" : "text-gray-900"}`}>
                    {item.onHand}
                  </p>
                  <p className="text-xs text-gray-500">
                    On Hand{item.unit ? ` (${item.unit})` : ""}
                  </p>
                </div>
                <div>
                  <p className="text-lg font-semibold text-gray-400">{item.reorderLevel}</p>
                  <p className="text-xs text-gray-400">Reorder At</p>
                </div>
              </div>
              {item.lastOrdered && (
                <p className="text-xs text-gray-400 mt-3">Last ordered: {item.lastOrdered}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
