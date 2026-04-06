"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import Link from "next/link";
import {
  Building,
  Search,
  Plus,
  MapPin,
  User,
  Phone,
  Mail,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  StickyNote,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import Badge, { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCurrency, cn } from "@/lib/utils";

interface Property {
  id: string;
  name: string;
  code: string;
  address?: string;
  status: string;
  ownerId?: string;
  ownerName?: string;
  ownerEmail?: string;
  ownerPhone?: string;
  owner?: { id: string; name: string; email?: string; phone?: string };
  defaultFee: number;
  defaultHouseCutPercent: number;
  billingType?: string;
  _count?: { notes: number };
}

const statusTabs = [
  { label: "Active", value: "active" },
  { label: "Inactive", value: "inactive" },
  { label: "All", value: "" },
];

function notify(message: string) {
  console.log("[CRN]", message);
}

export default function PropertiesPage() {
  const router = useRouter();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");

  useEffect(() => {
    fetchProperties();
  }, [statusFilter, search]);

  const fetchProperties = () => {
    setLoading(true);
    api
      .get<{ properties: Property[] }>("/properties", {
        status: statusFilter || undefined,
        search: search || undefined,
      })
      .then((data) => setProperties(data.properties))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const handleDelete = async (property: Property, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (
      !confirm(
        `Delete "${property.name}"? This will also delete all associated jobs and invoices.`
      )
    )
      return;

    try {
      await api.delete(`/properties/${property.id}`);
      notify(`${property.name} deleted`);
      fetchProperties();
    } catch (error) {
      notify("Failed to delete property");
    }
  };

  const activeCount = properties.filter((p) => p.status === "active").length;

  const resolveOwner = (prop: Property) => {
    if (prop.owner) return prop.owner;
    return {
      name: prop.ownerName || "No owner",
      email: prop.ownerEmail,
      phone: prop.ownerPhone,
    };
  };

  return (
    <div className="p-6 max-w-6xl">
      <PageHeader
        title="Properties"
        subtitle={`${activeCount} active propert${activeCount !== 1 ? "ies" : "y"}`}
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
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
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
              className={cn(
                "px-4 py-2 text-sm font-medium rounded-md transition-colors",
                statusFilter === tab.value
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              )}
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
              description="Add your first property to start managing jobs and invoices."
              action={{
                label: "Add Property",
                onClick: () => router.push("/properties/new"),
              }}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {properties.map((prop) => {
            const owner = resolveOwner(prop);
            const notesCount = prop._count?.notes ?? 0;
            const isInactive = prop.status !== "active";

            return (
              <Link key={prop.id} href={`/properties/${prop.id}`}>
                <Card
                  className={cn(
                    "hover:shadow-md transition-all cursor-pointer overflow-hidden h-full",
                    isInactive && "opacity-60 bg-gray-50"
                  )}
                >
                  {/* Placeholder for property image */}
                  <div className="h-2 bg-gradient-to-r from-blue-500 to-blue-600" />

                  <CardContent>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4
                            className={cn(
                              "font-semibold",
                              isInactive ? "text-gray-500" : "text-gray-900"
                            )}
                          >
                            {prop.name}
                          </h4>
                          <StatusBadge status={prop.status} />
                        </div>
                        <p className="text-xs text-gray-400 font-mono">
                          {prop.code}
                        </p>
                        {prop.address && (
                          <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
                            <MapPin size={14} />
                            <span className="line-clamp-1">{prop.address}</span>
                          </div>
                        )}
                      </div>
                      {!isInactive && prop.billingType && (
                        <Badge
                          variant={
                            prop.billingType === "monthly"
                              ? "warning"
                              : "info"
                          }
                        >
                          {prop.billingType === "monthly"
                            ? "Monthly"
                            : "Per Job"}
                        </Badge>
                      )}
                    </div>

                    {/* Fee & House Cut */}
                    <div className="flex items-center gap-4 mb-4">
                      <div>
                        <p className="text-2xl font-bold text-gray-900">
                          {formatCurrency(prop.defaultFee)}
                        </p>
                        <p className="text-xs text-gray-400">Default Fee</p>
                      </div>
                      <div>
                        <p className="text-lg font-semibold text-gray-900">
                          {prop.defaultHouseCutPercent}%
                        </p>
                        <p className="text-xs text-gray-400">House Cut</p>
                      </div>
                    </div>

                    {/* Owner Info */}
                    <div className="border-t pt-3 space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-gray-600">
                        <User size={14} />
                        {owner.name}
                      </div>
                      {owner.phone && (
                        <div className="flex items-center gap-2 text-gray-600">
                          <Phone size={14} />
                          {owner.phone}
                        </div>
                      )}
                      {owner.email && (
                        <div className="flex items-center gap-2 text-gray-600">
                          <Mail size={14} />
                          {owner.email}
                        </div>
                      )}
                    </div>

                    {/* Notes indicator */}
                    {notesCount > 0 && (
                      <div className="mt-3 p-2 bg-amber-50 rounded-lg text-sm text-amber-700 flex items-center gap-2">
                        <StickyNote size={14} />
                        {notesCount} active note{notesCount !== 1 && "s"}
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="mt-3 pt-3 border-t flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          router.push(`/properties/${prop.id}`);
                        }}
                      >
                        <Pencil size={14} />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 hover:bg-red-50"
                        onClick={(e) => handleDelete(prop, e)}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
