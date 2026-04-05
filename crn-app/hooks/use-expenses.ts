import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../services/api";

interface Expense {
  id: string;
  categoryId: string;
  category?: { id: string; name: string; code: string };
  amount: number;
  date: string;
  vendor?: string | null;
  description?: string | null;
  receiptUrl?: string | null;
  isDeductible: boolean;
  taxYear?: number | null;
  isReconciled: boolean;
  loggedById?: string | null;
}

interface ExpenseSummary {
  total: number;
  totalDeductible: number;
  breakdown: Array<{ categoryName: string; total: number }>;
}

export function useExpenses(params?: { categoryId?: string; startDate?: string; endDate?: string; vendor?: string; isDeductible?: boolean }) {
  return useQuery({
    queryKey: ["expenses", params],
    queryFn: () => api.get<Expense[]>("/expenses", { ...params }),
  });
}

export function useExpense(id: string | undefined) {
  return useQuery({
    queryKey: ["expenses", id],
    queryFn: () => api.get<Expense>(`/expenses/${id}`),
    enabled: !!id,
  });
}

export function useExpenseSummary(params?: { startDate?: string; endDate?: string }) {
  return useQuery({
    queryKey: ["expenses", "summary", params],
    queryFn: () => api.get<ExpenseSummary>("/expenses/summary", { ...params }),
  });
}

export function useCreateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { amount: number; date: string; categoryId: string; vendor?: string; description?: string; receiptUrl?: string; isDeductible?: boolean }) =>
      api.post<Expense>("/expenses", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useUpdateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<Expense>) =>
      api.patch<Expense>(`/expenses/${id}`, data),
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ["expenses", v.id] });
      qc.invalidateQueries({ queryKey: ["expenses"] });
    },
  });
}

export function useDeleteExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/expenses/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["expenses"] }); },
  });
}

export type { Expense, ExpenseSummary };
