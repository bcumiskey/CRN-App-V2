import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../services/api";

// ── Types ──────────────────────────────────────────────────────────

interface CalendarSource {
  id: string;
  name: string;
  type: string;
  url: string;
  propertyId?: string | null;
  property?: { id: string; name: string } | null;
  isActive: boolean;
  lastSyncAt?: string | null;
  lastSyncStatus?: string | null;
  lastSyncError?: string | null;
  syncIntervalMinutes: number;
}

interface SyncLog {
  id: string;
  calendarSourceId: string;
  status: string;
  eventsProcessed: number;
  eventsCreated: number;
  eventsUpdated: number;
  eventsSkipped: number;
  errors: Array<{ eventTitle: string; reason: string }> | null;
  startedAt: string;
  completedAt?: string | null;
  durationMs?: number | null;
}

interface UnmatchedEvent {
  id: string;
  rawSummary: string;
  date: string;
  status: string;
  calendarSourceId: string;
}

interface SyncResult {
  eventsProcessed: number;
  eventsCreated: number;
  eventsUpdated: number;
  eventsSkipped: number;
  errors: Array<{ eventTitle: string; reason: string }>;
}

// ── Calendar Sources ───────────────────────────────────────────────

export function useCalendarSources() {
  return useQuery({
    queryKey: ["calendar-sources"],
    queryFn: () => api.get<CalendarSource[]>("/calendar-sources"),
  });
}

export function useCalendarSource(id: string | undefined) {
  return useQuery({
    queryKey: ["calendar-sources", id],
    queryFn: () =>
      api.get<CalendarSource & { syncLogs: SyncLog[] }>(
        `/calendar-sources/${id}`
      ),
    enabled: !!id,
  });
}

export function useCreateCalendarSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (
      data: Pick<CalendarSource, "name" | "type" | "url" | "isActive" | "syncIntervalMinutes"> & {
        propertyId?: string | null;
      }
    ) => api.post<CalendarSource>("/calendar-sources", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["calendar-sources"] });
    },
  });
}

export function useUpdateCalendarSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: { id: string } & Partial<
      Pick<CalendarSource, "name" | "type" | "url" | "isActive" | "syncIntervalMinutes" | "propertyId">
    >) => api.patch<CalendarSource>(`/calendar-sources/${id}`, data),
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ["calendar-sources", v.id] });
      qc.invalidateQueries({ queryKey: ["calendar-sources"] });
    },
  });
}

export function useDeleteCalendarSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/calendar-sources/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["calendar-sources"] });
    },
  });
}

// ── Sync Actions ───────────────────────────────────────────────────

export function useSyncSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.post<SyncResult>(`/calendar-sources/${id}/sync`),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ["calendar-sources", id] });
      qc.invalidateQueries({ queryKey: ["calendar-sources"] });
      qc.invalidateQueries({ queryKey: ["sync-logs"] });
    },
  });
}

export function useSyncAll() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ synced: number }>("/calendar-sources/sync-all"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["calendar-sources"] });
      qc.invalidateQueries({ queryKey: ["sync-logs"] });
    },
  });
}

// ── Sync Logs ──────────────────────────────────────────────────────

export function useSyncLogs(params?: { calendarSourceId?: string; limit?: number }) {
  return useQuery({
    queryKey: ["sync-logs", params],
    queryFn: () => api.get<SyncLog[]>("/sync/logs", { ...params }),
  });
}

// ── Unmatched Events ───────────────────────────────────────────────

export function useUnmatchedEvents() {
  return useQuery({
    queryKey: ["unmatched-events"],
    queryFn: () => api.get<UnmatchedEvent[]>("/sync/unmatched"),
  });
}

export function useAssignUnmatchedEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, propertyId }: { id: string; propertyId: string }) =>
      api.post(`/sync/unmatched/${id}/assign`, { propertyId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["unmatched-events"] });
      qc.invalidateQueries({ queryKey: ["jobs"] });
    },
  });
}

export function useDismissUnmatchedEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/sync/unmatched/${id}/dismiss`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["unmatched-events"] });
    },
  });
}

export type { CalendarSource, SyncLog, SyncResult, UnmatchedEvent };
