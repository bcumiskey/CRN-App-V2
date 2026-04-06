"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Package, AlertCircle, CheckCircle, ShoppingCart } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDate } from "@/lib/utils";

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
      <PageHeader
        title="Supplies"
        subtitle="Track cleaning supply inventory"
        actions={
          reorderCount > 0 ? (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-200 rounded-lg">
              <ShoppingCart size={14} className="text-red-600" />
              <span className="text-sm font-medium text-red-700">{reorderCount} item{reorderCount > 1 ? "s" : ""} need reorder</span>
            </div>
          ) : undefined
        }
      />

      {loading ? (
        <p className="text-gray-400 text-sm">Loading...</p>
      ) : items.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={<Package size={40} />}
              title="No supplies tracked"
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
            <Card
              key={item.id}
              className={item.needsReorder ? "border-red-200" : ""}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900">{item.name}</h3>
                    {item.category && <p className="text-xs text-gray-400 mt-0.5">{item.category}</p>}
                  </div>
                  {item.needsReorder ? (
                    <Badge variant="danger">
                      <AlertCircle size={10} className="mr-1" /> Reorder
                    </Badge>
                  ) : (
                    <Badge variant="success">
                      <CheckCircle size={10} className="mr-1" /> Stocked
                    </Badge>
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
                  <p className="text-xs text-gray-400 mt-3">Last ordered: {formatDate(item.lastOrdered)}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
