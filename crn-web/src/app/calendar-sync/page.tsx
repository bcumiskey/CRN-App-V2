"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { RefreshCw, CheckCircle, AlertCircle, Clock, ExternalLink } from "lucide-react";

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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Calendar Sync</h1>
          <p className="text-sm text-gray-500 mt-1">Manage iCal calendar sources</p>
        </div>
        <button
          onClick={handleSyncAll}
          disabled={syncingAll}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={syncingAll ? "animate-spin" : ""} />
          {syncingAll ? "Syncing..." : "Sync All"}
        </button>
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">Loading...</p>
      ) : sources.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <RefreshCw size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">No calendar sources configured</p>
          <p className="text-gray-400 text-sm mt-1">Add an iCal URL to import bookings automatically</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sources.map((source) => (
            <div
              key={source.id}
              className="bg-white rounded-xl shadow-sm border border-gray-100 p-5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {statusIcon(source)}
                  <div>
                    <h3 className="font-semibold text-gray-900">{source.name}</h3>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                        {source.type}
                      </span>
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          source.status === "active"
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {source.status}
                      </span>
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
                  <button
                    onClick={() => handleSync(source.id)}
                    disabled={syncing === source.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <RefreshCw size={12} className={syncing === source.id ? "animate-spin" : ""} />
                    Sync
                  </button>
                </div>
              </div>
              {source.error && (
                <div className="mt-3 p-2.5 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-xs text-red-600">{source.error}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
