"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import Link from "next/link";
import { Building, Search, Plus } from "lucide-react";

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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Properties</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your cleaning properties</p>
        </div>
        <Link
          href="/properties/new"
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus size={16} />
          Add Property
        </Link>
      </div>

      {/* Search & Filter */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search properties..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
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
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <Building size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">No properties found</p>
          <p className="text-gray-400 text-sm mt-1">Add your first property to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {properties.map((prop) => (
            <Link
              key={prop.id}
              href={`/properties/${prop.id}`}
              className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:border-blue-200 hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900">{prop.name}</h3>
                  <p className="text-xs text-gray-400 font-mono">{prop.code}</p>
                </div>
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    prop.status === "active"
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {prop.status}
                </span>
              </div>
              {prop.address && (
                <p className="text-sm text-gray-500 mb-2 line-clamp-1">{prop.address}</p>
              )}
              {prop.ownerName && (
                <p className="text-sm text-gray-400 mb-3">{prop.ownerName}</p>
              )}
              <div className="flex items-center gap-4 pt-3 border-t border-gray-100">
                <div>
                  <p className="text-lg font-semibold text-gray-900">${prop.defaultFee}</p>
                  <p className="text-xs text-gray-400">Default Fee</p>
                </div>
                <div>
                  <p className="text-lg font-semibold text-gray-900">{prop.defaultHouseCutPercent}%</p>
                  <p className="text-xs text-gray-400">House Cut</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
