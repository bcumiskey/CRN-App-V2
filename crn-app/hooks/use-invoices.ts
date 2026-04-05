import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../services/api";

interface InvoiceLineItem {
  id: string;
  date?: string | null;
  description: string;
  amount: number;
  category?: string | null;
  jobId?: string | null;
  sortOrder: number;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  ownerId: string;
  owner: { id: string; name: string; email?: string | null };
  propertyId?: string | null;
  property?: { id: string; name: string } | null;
  type: string;
  billingPeriod?: string | null;
  invoiceDate: string;
  dueDate?: string | null;
  paymentTerms: string;
  subtotal: number;
  discount: number;
  total: number;
  status: string;
  notes?: string | null;
  internalNotes?: string | null;
  pdfUrl?: string | null;
  lineItems: InvoiceLineItem[];
  createdAt: string;
}

interface InvoiceListResponse {
  invoices: Invoice[];
  total: number;
}

interface InvoiceFilters {
  status?: string;
  ownerId?: string;
  propertyId?: string;
  startDate?: string;
  endDate?: string;
}

// ── Queries ─────────────────────────────────────────────────────

export function useInvoices(filters: InvoiceFilters = {}) {
  return useQuery({
    queryKey: ["invoices", filters],
    queryFn: () => api.get<InvoiceListResponse>("/invoices", { ...filters }),
  });
}

export function useInvoice(id: string | undefined) {
  return useQuery({
    queryKey: ["invoices", id],
    queryFn: () => api.get<Invoice>(`/invoices/${id}`),
    enabled: !!id,
  });
}

export function useUninvoicedJobs(params?: { ownerId?: string; propertyId?: string }) {
  return useQuery({
    queryKey: ["invoices", "uninvoiced-jobs", params],
    queryFn: () => api.get<any[]>("/invoices/uninvoiced-jobs", { ...params }),
  });
}

// ── Mutations ───────────────────────────────────────────────────

export function useCreateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Invoice> & { ownerId: string; type: string; invoiceDate: string }) =>
      api.post<Invoice>("/invoices", data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["invoices"] }); },
  });
}

export function useUpdateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<Invoice>) =>
      api.patch<Invoice>(`/invoices/${id}`, data),
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ["invoices", v.id] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
    },
  });
}

export function useSendInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/invoices/${id}/send`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["invoices"] }); },
  });
}

export function useMarkInvoicePaid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, paidDate, paymentMethod }: { id: string; paidDate: string; paymentMethod?: string }) =>
      api.patch(`/invoices/${id}/mark-paid`, { paidDate, paymentMethod }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["invoices"] }); },
  });
}

export function useVoidInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.patch(`/invoices/${id}/void`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["invoices"] }); },
  });
}

export function useDuplicateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<Invoice>(`/invoices/${id}/duplicate`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["invoices"] }); },
  });
}

export function useGenerateMonthlyInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { ownerId: string; billingPeriod: string }) =>
      api.post<Invoice>("/invoices/generate-monthly", data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["invoices"] }); },
  });
}

export function useAddLineItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ invoiceId, ...data }: { invoiceId: string; description: string; amount: number; date?: string; jobId?: string; category?: string }) =>
      api.post(`/invoices/${invoiceId}/line-items`, data),
    onSuccess: (_, v) => { qc.invalidateQueries({ queryKey: ["invoices", v.invoiceId] }); },
  });
}

export function useUpdateLineItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ invoiceId, lid, ...data }: { invoiceId: string; lid: string; amount?: number; description?: string }) =>
      api.patch(`/invoices/${invoiceId}/line-items/${lid}`, data),
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ["invoices", v.invoiceId] });
      qc.invalidateQueries({ queryKey: ["jobs"] });
    },
  });
}

export function useDeleteLineItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ invoiceId, lid }: { invoiceId: string; lid: string }) =>
      api.delete(`/invoices/${invoiceId}/line-items/${lid}`),
    onSuccess: (_, v) => { qc.invalidateQueries({ queryKey: ["invoices", v.invoiceId] }); },
  });
}

export type { Invoice, InvoiceLineItem, InvoiceFilters };
