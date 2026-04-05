import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../services/api";

// ── Types ───────────────────────────────────────────────────────

export interface PropertyPhoto {
  id: string;
  propertyId: string;
  url: string;
  thumbnailUrl?: string | null;
  caption?: string | null;
  roomId?: string | null;
  roomName?: string | null;
  photoType: "reference" | "setup" | "damage" | "general";
  isPrimary: boolean;
  uploadedById: string;
  createdAt: string;
}

export interface ChecklistItem {
  id: string;
  text: string;
  roomGroup?: string | null;
  isRequired: boolean;
  sortOrder: number;
}

export interface ChecklistWithItems {
  id: string;
  propertyId: string;
  name: string;
  jobTypeScope?: string | null;
  isActive: boolean;
  items: ChecklistItem[];
  createdAt: string;
  updatedAt: string;
}

export interface ChecklistTemplate {
  id: string;
  name: string;
  category: string;
  description?: string | null;
  items: Omit<ChecklistItem, "id">[];
}

export interface StandingInstruction {
  id: string;
  propertyId: string;
  text: string;
  category: string;
  priority: "critical" | "important" | "general" | "seasonal";
  seasonalStart?: string | null;
  seasonalEnd?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OwnerPreferences {
  id: string;
  propertyId: string;
  laundryMethod?: string | null;
  laundryLocation?: string | null;
  laundryNotes?: string | null;
  guestCommsMethod?: string | null;
  photoCheckIn: boolean;
  photoCheckOut: boolean;
  preferredTemp?: string | null;
  petPolicy?: string | null;
  earliestArrival?: string | null;
  latestDeparture?: string | null;
  keyReturnMethod?: string | null;
  updatedAt: string;
}

// ── Photo Queries & Mutations ──────────────────────────────────

export function usePropertyPhotos(propertyId: string | undefined) {
  return useQuery({
    queryKey: ["properties", propertyId, "photos"],
    queryFn: () => api.get<PropertyPhoto[]>(`/properties/${propertyId}/photos`),
    enabled: !!propertyId,
  });
}

export function useAddPropertyPhoto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      propertyId,
      ...data
    }: {
      propertyId: string;
      url: string;
      thumbnailUrl?: string;
      caption?: string;
      roomId?: string;
      photoType?: string;
      isPrimary?: boolean;
    }) => api.post<PropertyPhoto>(`/properties/${propertyId}/photos`, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["properties", variables.propertyId, "photos"],
      });
    },
  });
}

// ── Checklist Queries & Mutations ──────────────────────────────

export function usePropertyChecklists(propertyId: string | undefined) {
  return useQuery({
    queryKey: ["properties", propertyId, "checklists"],
    queryFn: () =>
      api.get<ChecklistWithItems[]>(`/properties/${propertyId}/checklists`),
    enabled: !!propertyId,
  });
}

export function useCreateChecklist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      propertyId,
      ...data
    }: {
      propertyId: string;
      name: string;
      jobTypeScope?: string;
      items?: Array<{ text: string; roomGroup?: string; isRequired?: boolean; sortOrder?: number }>;
    }) => api.post<ChecklistWithItems>(`/properties/${propertyId}/checklists`, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["properties", variables.propertyId, "checklists"],
      });
    },
  });
}

export function useUpdateChecklist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      propertyId,
      checklistId,
      ...data
    }: {
      propertyId: string;
      checklistId: string;
      name?: string;
      jobTypeScope?: string | null;
      isActive?: boolean;
      items?: Array<{
        id?: string;
        text: string;
        roomGroup?: string | null;
        isRequired?: boolean;
        sortOrder?: number;
      }>;
    }) =>
      api.patch<ChecklistWithItems>(
        `/properties/${propertyId}/checklists/${checklistId}`,
        data
      ),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["properties", variables.propertyId, "checklists"],
      });
    },
  });
}

export function useCopyChecklist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      propertyId,
      checklistId,
      targetPropertyId,
    }: {
      propertyId: string;
      checklistId: string;
      targetPropertyId: string;
    }) =>
      api.post<ChecklistWithItems>(
        `/properties/${propertyId}/checklists/${checklistId}/copy`,
        { targetPropertyId }
      ),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["properties", variables.targetPropertyId, "checklists"],
      });
    },
  });
}

export function useChecklistTemplates() {
  return useQuery({
    queryKey: ["checklist-templates"],
    queryFn: () => api.get<ChecklistTemplate[]>("/checklist-templates"),
  });
}

// ── Standing Instructions Queries & Mutations ──────────────────

export function useStandingInstructions(propertyId: string | undefined) {
  return useQuery({
    queryKey: ["properties", propertyId, "instructions"],
    queryFn: () =>
      api.get<StandingInstruction[]>(`/properties/${propertyId}/instructions`),
    enabled: !!propertyId,
  });
}

export function useCreateInstruction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      propertyId,
      ...data
    }: {
      propertyId: string;
      text: string;
      category: string;
      priority: string;
      seasonalStart?: string;
      seasonalEnd?: string;
    }) =>
      api.post<StandingInstruction>(
        `/properties/${propertyId}/instructions`,
        data
      ),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["properties", variables.propertyId, "instructions"],
      });
    },
  });
}

export function useUpdateInstruction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      propertyId,
      instructionId,
      ...data
    }: {
      propertyId: string;
      instructionId: string;
      text?: string;
      category?: string;
      priority?: string;
      seasonalStart?: string | null;
      seasonalEnd?: string | null;
      isActive?: boolean;
    }) =>
      api.patch<StandingInstruction>(
        `/properties/${propertyId}/instructions/${instructionId}`,
        data
      ),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["properties", variables.propertyId, "instructions"],
      });
    },
  });
}

export function useResolveNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      propertyId,
      noteId,
    }: {
      propertyId: string;
      noteId: string;
    }) =>
      api.patch(`/properties/${propertyId}/notes/${noteId}/resolve`, {
        resolved: true,
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["properties", variables.propertyId, "notes"],
      });
    },
  });
}

// ── Owner Preferences Queries & Mutations ──────────────────────

export function useOwnerPreferences(propertyId: string | undefined) {
  return useQuery({
    queryKey: ["properties", propertyId, "owner-preferences"],
    queryFn: () =>
      api.get<OwnerPreferences>(`/properties/${propertyId}/owner-preferences`),
    enabled: !!propertyId,
  });
}

export function useUpdateOwnerPreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      propertyId,
      ...data
    }: {
      propertyId: string;
    } & Partial<Omit<OwnerPreferences, "id" | "propertyId" | "updatedAt">>) =>
      api.patch<OwnerPreferences>(
        `/properties/${propertyId}/owner-preferences`,
        data
      ),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["properties", variables.propertyId, "owner-preferences"],
      });
    },
  });
}
