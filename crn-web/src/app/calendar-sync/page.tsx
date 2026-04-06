"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { RefreshCw, CheckCircle, AlertCircle, Clock, ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import Badge, { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

interface CalendarSource {
  id: string;
  name: string;
  url?: string;
  type: string;
  status: string;
  lastSyncAt?: string;
  lastSyncStatus?: string;
  eventsCount?: number;
  error?: string;
}

export default function CalendarSyncPage() {
  const [sources, setSources] = useState<CalendarSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);

  const fetchSources = () => {
    setLoading(true);
    api
      .get<{ sources: CalendarSource[] }>("/calendar-sources")
      .then((data) => setSources(data.sources))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchSources();
  }, []);

  const handleSync = async (sourceId: string) => {
    setSyncing(sourceId);
    try {
      await api.post(`/calendar-sources/${sourceId}/sync`);
      fetchSources();
    } catch (err) {
      console.error(err);
    } finally {
      setSyncing(null);
    }
  };

  const handleSyncAll = async () => {
    setSyncingAll(true);
    try {
      await api.post("/calendar-sources/sync-all");
      fetchSources();
    } catch (err) {
      console.error(err);
    } finally {
      setSyncingAll(false);
    }
  };

  const statusIcon = (source: CalendarSource) => {
    if (source.lastSyncStatus === "success") {
      return <CheckCircle size={16} className="text-green-500" />;
    }
    if (source.lastSyncStatus === "error") {
      return <AlertCircle size={16} className="text-red-500" />;
    }
    return <Clock size={16} className="text-gray-400" />;
  };

  return (
    <div className="p-6 max-w-6xl">
      <PageHeader
        title="Calendar Sync"
        subtitle="Manage iCal calendar sources"
        actions={
          <Button
            onClick={handleSyncAll}
            disabled={syncingAll}
            variant="primary"
            loading={syncingAll}
          >
            <RefreshCw size={14} className={syncingAll ? "animate-spin" : ""} />
            Sync All
          </Button>
        }
      />

      {loading ? (
        <p className="text-gray-400 text-sm">Loading...</p>
      ) : sources.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={<RefreshCw size={40} />}
              title="No calendar sources configured"
              description="Add an iCal URL to import bookings automatically"
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {sources.map((source) => (
            <Card key={source.id}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {statusIcon(source)}
                    <div>
                      <h3 className="font-semibold text-gray-900">{source.name}</h3>
                      <div className="flex items-center gap-3 mt-1">
                        <Badge>{source.type}</Badge>
                        <StatusBadge status={source.status} />
                        {source.eventsCount !== undefined && (
                          <span className="text-xs text-gray-400">{source.eventsCount} events</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {source.lastSyncAt && (
                      <p className="text-xs text-gray-400">
                        Last sync: {new Date(source.lastSyncAt).toLocaleString()}
                      </p>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSync(source.id)}
                      disabled={syncing === source.id}
                    >
                      <RefreshCw size={12} className={syncing === source.id ? "animate-spin" : ""} />
                      Sync
                    </Button>
                  </div>
                </div>
                {source.error && (
                  <div className="mt-3 p-2.5 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-xs text-red-600">{source.error}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
