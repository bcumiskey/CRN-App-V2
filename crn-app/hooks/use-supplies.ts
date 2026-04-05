import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../services/api";

// ── Types ──────────────────────────────────────────────────────────────

interface Supply {
  id: string;
  name: string;
  category: string;
  onHand: number;
  reorderLevel: number;
  reorderQuantity: number;
  unitCost: number;
  unit: string;
  vendor: string;
  isActive: boolean;
}

interface ReorderItem {
  id: string;
  name: string;
  category: string;
  onHand: number;
  reorderLevel: number;
  reorderQuantity: number;
  unitCost: number;
  unit: string;
  vendor: string;
  lineTotal: number;
}

interface ReorderVendorGroup {
  vendor: string;
  items: ReorderItem[];
  groupTotal: number;
}

interface ReorderListData {
  groups: ReorderVendorGroup[];
  grandTotal: number;
}

// ── Queries ────────────────────────────────────────────────────────────

export function useSupplies(params?: { category?: string; status?: string }) {
  return useQuery({
    queryKey: ["supplies", params],
    queryFn: () => api.get<Supply[]>("/supplies", { ...params }),
  });
}

export function useSupplyReorderList() {
  return useQuery({
    queryKey: ["supplies", "reorder-list"],
    queryFn: () => api.get<ReorderListData>("/supplies/reorder-list"),
  });
}

export function useSupply(id: string | undefined) {
  return useQuery({
    queryKey: ["supplies", id],
    queryFn: () => api.get<Supply>(`/supplies/${id}`),
    enabled: !!id,
  });
}

// ── Mutations ──────────────────────────────────────────────────────────

export function useCreateSupply() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string;
      category: string;
      onHand?: number;
      reorderLevel: number;
      reorderQuantity: number;
      unitCost: number;
      unit: string;
      vendor: string;
    }) => api.post<Supply>("/supplies", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["supplies"] });
    },
  });
}

export function useUpdateSupply() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<Supply>) =>
      api.patch<Supply>(`/supplies/${id}`, data),
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ["supplies", v.id] });
      qc.invalidateQueries({ queryKey: ["supplies"] });
    },
  });
}

export function useDeleteSupply() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/supplies/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["supplies"] });
    },
  });
}

export type { Supply, ReorderItem, ReorderVendorGroup, ReorderListData };
