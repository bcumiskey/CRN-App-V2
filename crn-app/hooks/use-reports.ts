import { useQuery } from "@tanstack/react-query";
import { api } from "../services/api";

interface DateRangeParams {
  startDate?: string;
  endDate?: string;
  preset?: string;
}

// ── Financial Reports ───────────────────────────────────────────

interface PnlData {
  grossRevenue: number;
  houseCuts: number;
  netRevenue: number;
  businessExpense: number;
  ownerProfit: number;
  workerPool: number;
  operatingExpenses: Array<{ category: string; amount: number }>;
  totalExpenses: number;
  netProfit: number;
}

interface RevenueData {
  items: Array<{ label: string; revenue: number; jobCount: number; avgPerJob: number }>;
}

interface CashFlowData {
  moneyIn: number;
  moneyOut: number;
  netCashFlow: number;
  timeline: Array<{ date: string; type: string; description: string; amount: number }>;
}

interface ArAgingData {
  current: number;
  days1to30: number;
  days31to60: number;
  days60plus: number;
  totalOutstanding: number;
  invoices: Array<{ id: string; invoiceNumber: string; ownerName: string; amount: number; dueDate: string; daysOverdue: number; status: string }>;
}

// ── Property Reports ────────────────────────────────────────────

interface PropertyRevenueItem {
  propertyId: string;
  propertyName: string;
  jobCount: number;
  totalRevenue: number;
  avgPerJob: number;
  houseCut: number;
  netToCRN: number;
}

interface PropertyProfitItem extends PropertyRevenueItem {
  laborCost: number;
  profit: number;
  margin: number;
}

// ── Team Reports ────────────────────────────────────────────────

interface WorkerEarningsItem {
  userId: string;
  userName: string;
  jobsWorked: number;
  totalShares: number;
  workerPoolPay: number;
  ownerPay: number;
  totalPay: number;
  avgPerJob: number;
  requires1099: boolean;
}

// ── Tax Reports ─────────────────────────────────────────────────

interface ScheduleCItem {
  line: string;
  category: string;
  amount: number;
}

interface Summary1099Item {
  userId: string;
  userName: string;
  totalPaid: number;
  requires1099: boolean;
  w9OnFile: boolean;
}

// ── Queries ─────────────────────────────────────────────────────

export function usePnlReport(params: DateRangeParams = {}) {
  return useQuery({
    queryKey: ["reports", "pnl", params],
    queryFn: () => api.get<PnlData>("/reports/pnl", { ...params }),
  });
}

export function useRevenueReport(params: DateRangeParams & { groupBy?: string } = {}) {
  return useQuery({
    queryKey: ["reports", "revenue", params],
    queryFn: () => api.get<RevenueData>("/reports/revenue", { ...params }),
  });
}

export function useCashFlowReport(params: DateRangeParams = {}) {
  return useQuery({
    queryKey: ["reports", "cash-flow", params],
    queryFn: () => api.get<CashFlowData>("/reports/cash-flow", { ...params }),
  });
}

export function useArAgingReport() {
  return useQuery({
    queryKey: ["reports", "ar-aging"],
    queryFn: () => api.get<ArAgingData>("/reports/ar-aging"),
  });
}

export function usePropertyRevenueReport(params: DateRangeParams = {}) {
  return useQuery({
    queryKey: ["reports", "property-revenue", params],
    queryFn: () => api.get<PropertyRevenueItem[]>("/reports/property-revenue", { ...params }),
  });
}

export function usePropertyProfitabilityReport(params: DateRangeParams = {}) {
  return useQuery({
    queryKey: ["reports", "property-profitability", params],
    queryFn: () => api.get<PropertyProfitItem[]>("/reports/property-profitability", { ...params }),
  });
}

export function useWorkerEarningsReport(params: DateRangeParams = {}) {
  return useQuery({
    queryKey: ["reports", "worker-earnings", params],
    queryFn: () => api.get<WorkerEarningsItem[]>("/reports/worker-earnings", { ...params }),
  });
}

export function useCompletionRateReport(params: DateRangeParams = {}) {
  return useQuery({
    queryKey: ["reports", "completion-rate", params],
    queryFn: () => api.get<any>("/reports/completion-rate", { ...params }),
  });
}

export function useJobVolumeReport(params: DateRangeParams = {}) {
  return useQuery({
    queryKey: ["reports", "job-volume", params],
    queryFn: () => api.get<any>("/reports/job-volume", { ...params }),
  });
}

export function useJobTypeMixReport(params: DateRangeParams = {}) {
  return useQuery({
    queryKey: ["reports", "job-type-mix", params],
    queryFn: () => api.get<any>("/reports/job-type-mix", { ...params }),
  });
}

export function use1099SummaryReport(params: { taxYear?: number } = {}) {
  return useQuery({
    queryKey: ["reports", "1099-summary", params],
    queryFn: () => api.get<Summary1099Item[]>("/reports/1099-summary", { ...params }),
  });
}

export function useScheduleCReport(params: DateRangeParams = {}) {
  return useQuery({
    queryKey: ["reports", "schedule-c", params],
    queryFn: () => api.get<ScheduleCItem[]>("/reports/schedule-c", { ...params }),
  });
}

export function useMileageSummaryReport(params: DateRangeParams = {}) {
  return useQuery({
    queryKey: ["reports", "mileage-summary", params],
    queryFn: () => api.get<any>("/reports/mileage-summary", { ...params }),
  });
}

export type {
  PnlData,
  RevenueData,
  CashFlowData,
  ArAgingData,
  PropertyRevenueItem,
  PropertyProfitItem,
  WorkerEarningsItem,
  ScheduleCItem,
  Summary1099Item,
  DateRangeParams,
};
