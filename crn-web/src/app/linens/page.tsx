"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Package, AlertTriangle, CheckCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

interface LinenItem {
  id: string;
  name: string;
  category?: string;
  onHand: number;
  target: number;
  status: string;
}

export default function LinensPage() {
  const [items, setItems] = useState<LinenItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<{ items: LinenItem[] }>("/linens")
      .then((data) => setItems(data.items))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const deficitCount = items.filter((i) => i.onHand < i.target).length;

  return (
    <div className="p-6 max-w-6xl">
      <PageHeader
        title="Linens"
        subtitle="Track linen inventory levels"
        actions={
          deficitCount > 0 ? (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertTriangle size={14} className="text-amber-600" />
              <span className="text-sm font-medium text-amber-700">{deficitCount} item{deficitCount > 1 ? "s" : ""} below target</span>
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
              title="No linen items"
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => {
            const isDeficit = item.onHand < item.target;
            return (
              <Card
                key={item.id}
                className={isDeficit ? "border-amber-200" : ""}
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-gray-900">{item.name}</h3>
                      {item.category && <p className="text-xs text-gray-400 mt-0.5">{item.category}</p>}
                    </div>
                    {isDeficit ? (
                      <Badge variant="warning">
                        <AlertTriangle size={10} className="mr-1" /> Deficit
                      </Badge>
                    ) : (
                      <Badge variant="success">
                        <CheckCircle size={10} className="mr-1" /> OK
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-end gap-6">
                    <div>
                      <p className={`text-2xl font-bold ${isDeficit ? "text-amber-600" : "text-gray-900"}`}>
                        {item.onHand}
                      </p>
                      <p className="text-xs text-gray-500">On Hand</p>
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-gray-400">{item.target}</p>
                      <p className="text-xs text-gray-400">Target</p>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        isDeficit ? "bg-amber-400" : "bg-green-400"
                      }`}
                      style={{ width: `${Math.min(100, (item.onHand / item.target) * 100)}%` }}
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
