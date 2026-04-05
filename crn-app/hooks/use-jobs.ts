import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../services/api";

// ── Types ───────────────────────────────────────────────────────

interface JobAssignment {
  id: string;
  userId: string;
  share: number;
  user: { id: string; name: string; isOwner: boolean };
}

interface JobCharge {
  id: string;
  amount: number;
  reason: string;
}

interface Job {
  id: string;
  jobNumber: string;
  propertyId: string;
  property: { id: string; name: string; address?: string; houseCutPercent: number };
  scheduledDate: string;
  scheduledTime?: string | null;
  jobType: string;
  jobTypeLabel?: string | null;
  totalFee: number;
  houseCutPercent: number;
  status: string;
  completedDate?: string | null;
  clientPaid: boolean;
  clientPaidDate?: string | null;
  clientPaidMethod?: string | null;
  teamPaid: boolean;
  teamPaidDate?: string | null;
  source: string;
  syncLocked: boolean;
  isBtoB: boolean;
  notes?: string | null;
  assignments: JobAssignment[];
  charges: JobCharge[];
  createdAt: string;
}

interface JobListResponse {
  jobs: Job[];
  total: number;
}

interface JobFilters {
  status?: string[];
  propertyId?: string;
  startDate?: string;
  endDate?: string;
  clientPaid?: boolean;
  teamPaid?: boolean;
  limit?: number;
  offset?: number;
}

// ── Queries ─────────────────────────────────────────────────────

export function useJobs(filters: JobFilters = {}) {
  return useQuery({
    queryKey: ["jobs", filters],
    queryFn: () =>
      api.get<JobListResponse>("/jobs", {
        status: filters.status?.join(","),
        propertyId: filters.propertyId,
        startDate: filters.startDate,
        endDate: filters.endDate,
        clientPaid: filters.clientPaid,
        teamPaid: filters.teamPaid,
        limit: filters.limit ?? 50,
        offset: filters.offset ?? 0,
      }),
  });
}

export function useJob(id: string | undefined) {
  return useQuery({
    queryKey: ["jobs", id],
    queryFn: () => api.get<Job>(`/jobs/${id}`),
    enabled: !!id,
  });
}

// ── Mutations ───────────────────────────────────────────────────

export function useCreateJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      propertyId: string;
      scheduledDate: string;
      totalFee: number;
      houseCutPercent: number;
      scheduledTime?: string;
      jobType?: string;
      jobTypeLabel?: string;
      isBtoB?: boolean;
      notes?: string;
      assignments?: Array<{ userId: string; share: number }>;
    }) => api.post<Job>("/jobs", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useUpdateJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, unknown>) =>
      api.patch<Job>(`/jobs/${id}`, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["jobs", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useUpdateJobStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/jobs/${id}/status`, { status }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["jobs", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useDeleteJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/jobs/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

// ── Assignment mutations ────────────────────────────────────────

export function useAddAssignment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ jobId, userId, share }: { jobId: string; userId: string; share: number }) =>
      api.post(`/jobs/${jobId}/assignments`, { userId, share }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["jobs", variables.jobId] });
    },
  });
}

export function useUpdateAssignment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ jobId, assignmentId, share }: { jobId: string; assignmentId: string; share: number }) =>
      api.patch(`/jobs/${jobId}/assignments/${assignmentId}`, { share }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["jobs", variables.jobId] });
    },
  });
}

export function useRemoveAssignment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ jobId, assignmentId }: { jobId: string; assignmentId: string }) =>
      api.delete(`/jobs/${jobId}/assignments/${assignmentId}`),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["jobs", variables.jobId] });
    },
  });
}

// ── Charge mutations ────────────────────────────────────────────

export function useAddCharge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ jobId, amount, reason }: { jobId: string; amount: number; reason: string }) =>
      api.post(`/jobs/${jobId}/charges`, { amount, reason }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["jobs", variables.jobId] });
    },
  });
}

export function useRemoveCharge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ jobId, chargeId }: { jobId: string; chargeId: string }) =>
      api.delete(`/jobs/${jobId}/charges/${chargeId}`),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["jobs", variables.jobId] });
    },
  });
}

export type { Job, JobAssignment, JobCharge, JobListResponse, JobFilters };
