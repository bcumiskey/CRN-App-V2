import { useQuery } from "@tanstack/react-query";
import { api } from "../services/api";
import type { Job } from "./use-jobs";

interface DashboardStats {
  jobsThisMonth: number;
  jobsCompleted: number;
  revenueThisMonth: number;
  outstandingInvoices: number;
  outstandingAmount: number;
}

interface Alert {
  id: string;
  type: string;
  message: string;
  createdAt: string;
}

export function useTodayJobs() {
  return useQuery({
    queryKey: ["dashboard", "today"],
    queryFn: () => api.get<{ jobs: Job[] }>("/dashboard/today"),
  });
}

export function useDashboardStats() {
  return useQuery({
    queryKey: ["dashboard", "stats"],
    queryFn: () => api.get<DashboardStats>("/dashboard/stats"),
  });
}

export function useAlerts() {
  return useQuery({
    queryKey: ["dashboard", "alerts"],
    queryFn: () => api.get<{ alerts: Alert[] }>("/dashboard/alerts"),
  });
}

export type { DashboardStats, Alert };
