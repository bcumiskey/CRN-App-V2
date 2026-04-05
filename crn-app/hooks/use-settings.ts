import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../services/api";

interface CompanySettings {
  id: string;
  businessName: string;
  ownerName: string;
  email: string;
  phone: string;
  address: string;
  financialModel: {
    buckets: Array<{ name: string; percent: number; type: string }>;
    shareLevels: Array<{ label: string; value: number }>;
  };
  mileageRate: number;
  taxYear: number;
  contractor1099Threshold: number;
  payPeriodType: string;
  defaultPaymentTerms: string;
  invoicePrefix: string;
  invoiceNextNumber: number;
  jobPrefix: string;
  jobNextNumber: number;
  businessHoursStart: string;
  businessHoursEnd: string;
  timezone: string;
}

interface UserPreferences {
  id: string;
  tabBarSlots: Array<{ position: number; section: string }>;
  centerAction: string;
  defaultJobsView: string;
  defaultCalendarView: string;
  jobCompletionAction: string;
  dashboardCards: unknown;
  notifyUpcomingJobs: boolean;
  notifyScheduleChanges: boolean;
  notifyOverdueInvoices: boolean;
  upcomingJobLeadDays: number;
  startOfWeek: string;
  timeFormat: string;
}

export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: () => api.get<CompanySettings>("/settings"),
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<CompanySettings>) =>
      api.patch<CompanySettings>("/settings", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
  });
}

export function usePreferences() {
  return useQuery({
    queryKey: ["preferences"],
    queryFn: () => api.get<UserPreferences>("/settings/preferences"),
  });
}

export function useUpdatePreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<UserPreferences>) =>
      api.patch<UserPreferences>("/settings/preferences", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["preferences"] });
    },
  });
}

export type { CompanySettings, UserPreferences };
