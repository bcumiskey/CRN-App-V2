import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../services/api";

// ── Types ──────────────────────────────────────────────────────────────

interface LinenRequirement {
  id: string;
  propertyId: string;
  propertyName: string;
  quantityPerFlip: number;
}

interface LinenItem {
  id: string;
  name: string;
  code: string;
  category: string;
  unitCost: number;
  vendor: string;
  vendorSku?: string | null;
  onHand: number;
  isActive: boolean;
  requirements: LinenRequirement[];
}

interface LinenMatrixProperty {
  id: string;
  name: string;
  code: string;
}

interface LinenMatrixItem {
  id: string;
  name: string;
  code: string;
  category: string;
  onHand: number;
  requirements: Record<string, number>; // propertyId → quantityPerFlip
  target: number;
  status: "ok" | "slight_deficit" | "severe_deficit";
}

interface LinenMatrixData {
  properties: LinenMatrixProperty[];
  items: LinenMatrixItem[];
}

interface ShoppingListItem {
  id: string;
  name: string;
  code: string;
  deficit: number;
  unitCost: number;
  lineTotal: number;
}

interface ShoppingListVendorGroup {
  vendor: string;
  items: ShoppingListItem[];
  groupTotal: number;
}

interface ShoppingListData {
  groups: ShoppingListVendorGroup[];
  grandTotal: number;
}

// ── Queries ────────────────────────────────────────────────────────────

export function useLinens(params?: { category?: string; status?: string }) {
  return useQuery({
    queryKey: ["linens", params],
    queryFn: () => api.get<LinenItem[]>("/linens", { ...params }),
  });
}

export function useLinenMatrix() {
  return useQuery({
    queryKey: ["linens", "matrix"],
    queryFn: () => api.get<LinenMatrixData>("/linens/matrix"),
  });
}

export function useLinenShoppingList() {
  return useQuery({
    queryKey: ["linens", "shopping-list"],
    queryFn: () => api.get<ShoppingListData>("/linens/shopping-list"),
  });
}

export function useLinen(id: string | undefined) {
  return useQuery({
    queryKey: ["linens", id],
    queryFn: () => api.get<LinenItem>(`/linens/${id}`),
    enabled: !!id,
  });
}

// ── Mutations ──────────────────────────────────────────────────────────

export function useCreateLinen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string;
      code: string;
      category: string;
      unitCost: number;
      vendor: string;
      vendorSku?: string;
      onHand?: number;
    }) => api.post<LinenItem>("/linens", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["linens"] });
    },
  });
}

export function useUpdateLinen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<LinenItem>) =>
      api.patch<LinenItem>(`/linens/${id}`, data),
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ["linens", v.id] });
      qc.invalidateQueries({ queryKey: ["linens"] });
    },
  });
}

export function useBulkAdjustLinens() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { adjustments: Array<{ id: string; addQuantity: number }> }) =>
      api.patch<void>("/linens/bulk-adjust", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["linens"] });
    },
  });
}

export function useAddLinenRequirement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      linenId,
      ...data
    }: {
      linenId: string;
      propertyId: string;
      quantityPerFlip: number;
    }) => api.post(`/linens/${linenId}/requirements`, data),
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ["linens", v.linenId] });
      qc.invalidateQueries({ queryKey: ["linens"] });
    },
  });
}

export type {
  LinenItem,
  LinenRequirement,
  LinenMatrixData,
  LinenMatrixItem,
  LinenMatrixProperty,
  ShoppingListData,
  ShoppingListVendorGroup,
  ShoppingListItem,
};
