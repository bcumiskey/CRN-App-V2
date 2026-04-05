import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../services/api";

interface WorkerEarnings {
  userId: string;
  userName: string;
  jobsWorked: number;
  totalShares: number;
  workerPoolPay: number;
  ownerPay: number;
  grossPay: number;
}

interface PayPeriod {
  id: string;
  startDate: string;
  endDate: string;
  status: string;
  closedAt?: string | null;
  paidAt?: string | null;
  perWorker?: WorkerEarnings[];
}

interface PayStatement {
  id: string;
  payPeriodId: string;
  userId: string;
  user?: { name: string };
  jobsWorked: number;
  totalShares: number;
  workerPoolPay: number;
  ownerPay: number;
  grossPay: number;
  pdfUrl?: string | null;
  sentAt?: string | null;
}

export function usePayPeriods() {
  return useQuery({
    queryKey: ["pay-periods"],
    queryFn: () => api.get<PayPeriod[]>("/pay-periods"),
  });
}

export function usePayPeriod(id: string | undefined) {
  return useQuery({
    queryKey: ["pay-periods", id],
    queryFn: () => api.get<PayPeriod>(`/pay-periods/${id}`),
    enabled: !!id,
  });
}

export function useCreatePayPeriod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data?: { startDate: string; endDate: string }) =>
      api.post<PayPeriod>("/pay-periods", data ?? {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pay-periods"] }); },
  });
}

export function useClosePayPeriod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.patch(`/pay-periods/${id}/close`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pay-periods"] }); },
  });
}

export function useReopenPayPeriod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.patch(`/pay-periods/${id}/reopen`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pay-periods"] }); },
  });
}

export function useMarkPayPeriodPaid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.patch(`/pay-periods/${id}/mark-paid`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pay-periods"] }); },
  });
}

export type { PayPeriod, PayStatement, WorkerEarnings };
