"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import Link from "next/link";
import { Building, Search, Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCurrency } from "@/lib/utils";

interface Property {
  id: string;
  name: string;
  code: string;
  address?: string;
  ownerName?: string;
  defaultFee: number;
  defaultHouseCutPercent: number;
  status: string;
}

const statusTabs = [
  { label: "Active", value: "active" },
  { label: "Inactive", value: "inactive" },
  { label: "All", value: "" },
];

export default function PropertiesPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");

  useEffect(() => {
    setLoading(true);
    api
      .get<{ properties: Property[] }>("/properties", {
        status: statusFilter || undefined,
        search: search || undefined,
      })
      .then((data) => setProperties(data.properties))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [statusFilter, search]);

  return (
    <div className="p-6 max-w-6xl">
      <PageHeader
        title="Properties"
        subtitle="Manage your cleaning properties"
        actions={
          <Link href="/properties/new">
            <Button variant="primary">
              <Plus size={16} />
              Add Property
            </Button>
          </Link>
        }
      />

      {/* Search & Filter */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search properties..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {statusTabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                statusFilter === tab.value
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Property Cards Grid */}
      {loading ? (
        <p className="text-gray-400 text-sm">Loading...</p>
      ) : properties.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={<Building size={40} />}
              title="No properties found"
              description="Add your first property to get started"
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {properties.map((prop) => (
            <Link
              key={prop.id}
              href={`/properties/${prop.id}`}
            >
              <Card className="p-5 hover:border-blue-200 hover:shadow-md transition-all h-full">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900">{prop.name}</h3>
                    <p className="text-xs text-gray-400 font-mono">{prop.code}</p>
                  </div>
                  <StatusBadge status={prop.status} />
                </div>
                {prop.address && (
                  <p className="text-sm text-gray-500 mb-2 line-clamp-1">{prop.address}</p>
                )}
                {prop.ownerName && (
                  <p className="text-sm text-gray-400 mb-3">{prop.ownerName}</p>
                )}
                <div className="flex items-center gap-4 pt-3 border-t border-gray-100">
                  <div>
                    <p className="text-lg font-semibold text-gray-900">{formatCurrency(prop.defaultFee)}</p>
                    <p className="text-xs text-gray-400">Default Fee</p>
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-gray-900">{prop.defaultHouseCutPercent}%</p>
                    <p className="text-xs text-gray-400">House Cut</p>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
