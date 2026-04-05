import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../services/api";

// ── Worker Types (scoped — no financial data) ───────────────────

interface WorkerJob {
  id: string;
  jobNumber: string;
  propertyId: string;
  property: {
    name: string;
    address?: string | null;
    accessInstructions?: string | null;
    parkingNotes?: string | null;
    wifiName?: string | null;
    wifiPassword?: string | null;
  };
  scheduledDate: string;
  scheduledTime?: string | null;
  jobType: string;
  status: string;
  isBtoB: boolean;
  notes?: string | null;
  assignments: Array<{ userName: string }>;
}

interface WorkerPayJob {
  jobId: string;
  date: string;
  propertyName: string;
  jobType: string;
  yourPay: number;
}

interface WorkerPayPeriod {
  periodLabel: string;
  periodStatus: string;
  startDate: string;
  endDate: string;
  jobsWorked: number;
  totalEarned: number;
  jobs: WorkerPayJob[];
}

interface WorkerProperty {
  id: string;
  name: string;
  address?: string | null;
  lastCleanedDate?: string | null;
}

interface WorkerPropertyDetail {
  id: string;
  name: string;
  address?: string | null;
  accessInstructions?: string | null;
  parkingNotes?: string | null;
  wifiName?: string | null;
  wifiPassword?: string | null;
  trashDay?: string | null;
  specialInstructions?: string | null;
  rooms: Array<{
    id: string;
    name: string;
    type: string;
    floor?: string | null;
    bedType?: string | null;
    bedCount: number;
    towelCount?: number | null;
    stockingNotes?: string | null;
  }>;
}

interface WorkerProfile {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  emergencyContact?: string | null;
  emergencyPhone?: string | null;
  avatarUrl?: string | null;
}

// ── Queries ─────────────────────────────────────────────────────

export function useWorkerTodayJobs() {
  return useQuery({
    queryKey: ["worker", "today"],
    queryFn: () => api.get<{ jobs: WorkerJob[] }>("/worker/today"),
  });
}

export function useWorkerSchedule(params?: { startDate?: string; endDate?: string }) {
  return useQuery({
    queryKey: ["worker", "schedule", params],
    queryFn: () =>
      api.get<{ jobs: WorkerJob[] }>("/worker/schedule", {
        startDate: params?.startDate,
        endDate: params?.endDate,
      }),
  });
}

export function useWorkerJob(id: string | undefined) {
  return useQuery({
    queryKey: ["worker", "jobs", id],
    queryFn: () => api.get<WorkerJob>(`/worker/jobs/${id}`),
    enabled: !!id,
  });
}

export function useWorkerPay(periodId?: string) {
  return useQuery({
    queryKey: ["worker", "pay", periodId],
    queryFn: () =>
      periodId
        ? api.get<WorkerPayPeriod>(`/worker/pay/${periodId}`)
        : api.get<WorkerPayPeriod>("/worker/pay"),
  });
}

export function useWorkerProperties() {
  return useQuery({
    queryKey: ["worker", "properties"],
    queryFn: () => api.get<WorkerProperty[]>("/worker/properties"),
  });
}

export function useWorkerProperty(id: string | undefined) {
  return useQuery({
    queryKey: ["worker", "properties", id],
    queryFn: () => api.get<WorkerPropertyDetail>(`/worker/properties/${id}`),
    enabled: !!id,
  });
}

export function useWorkerProfile() {
  return useQuery({
    queryKey: ["worker", "profile"],
    queryFn: () => api.get<WorkerProfile>("/worker/profile"),
  });
}

// ── Mutations ───────────────────────────────────────────────────

export function useWorkerUpdateJobStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/worker/jobs/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["worker", "today"] });
      queryClient.invalidateQueries({ queryKey: ["worker", "schedule"] });
    },
  });
}

export function useWorkerAddNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { propertyId: string; content: string; noteType?: string; photoUrl?: string }) =>
      api.post("/worker/notes", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["worker", "properties"] });
    },
  });
}

export function useWorkerUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<WorkerProfile>) =>
      api.patch<WorkerProfile>("/worker/profile", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["worker", "profile"] });
    },
  });
}

export type {
  WorkerJob,
  WorkerPayJob,
  WorkerPayPeriod,
  WorkerProperty,
  WorkerPropertyDetail,
  WorkerProfile,
};
