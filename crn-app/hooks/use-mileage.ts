import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../services/api";

interface MileageEntry {
  id: string;
  userId: string;
  date: string;
  startLocation?: string | null;
  endLocation?: string | null;
  miles: number;
  purpose?: string | null;
  ratePerMile: number;
  deductionAmount: number;
  jobId?: string | null;
}

interface MileageSummary {
  totalTrips: number;
  totalMiles: number;
  totalDeduction: number;
  currentRate: number;
}

export function useMileage(params?: { startDate?: string; endDate?: string }) {
  return useQuery({
    queryKey: ["mileage", params],
    queryFn: () => api.get<MileageEntry[]>("/mileage", { ...params }),
  });
}

export function useMileageSummary(params?: { startDate?: string; endDate?: string }) {
  return useQuery({
    queryKey: ["mileage", "summary", params],
    queryFn: () => api.get<MileageSummary>("/mileage/summary", { ...params }),
  });
}

export function useCreateMileage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { date: string; miles: number; startLocation?: string; endLocation?: string; purpose?: string; jobId?: string }) =>
      api.post<MileageEntry>("/mileage", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mileage"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useUpdateMileage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<MileageEntry>) =>
      api.patch<MileageEntry>(`/mileage/${id}`, data),
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ["mileage", v.id] });
      qc.invalidateQueries({ queryKey: ["mileage"] });
    },
  });
}

export function useDeleteMileage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/mileage/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mileage"] }); },
  });
}

export type { MileageEntry, MileageSummary };
