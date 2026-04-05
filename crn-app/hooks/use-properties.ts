import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../services/api";

interface PropertyOwner {
  id: string;
  name: string;
}

interface Room {
  id: string;
  name: string;
  floor?: string | null;
  type: string;
  bedType?: string | null;
  bedCount: number;
  hasCrib: boolean;
  hasMurphy: boolean;
  hasTrundle: boolean;
  hasPullout: boolean;
  towelCount?: number | null;
  hasRug: boolean;
  hasRobes: boolean;
  hasSlippers: boolean;
  stockingNotes?: string | null;
  sortOrder: number;
}

interface Property {
  id: string;
  name: string;
  code: string;
  address?: string | null;
  ownerId?: string | null;
  owner?: PropertyOwner | null;
  defaultJobFee?: number | null;
  houseCutPercent: number;
  status: string;
  accessInstructions?: string | null;
  parkingNotes?: string | null;
  wifiName?: string | null;
  wifiPassword?: string | null;
  trashDay?: string | null;
  specialInstructions?: string | null;
  rooms?: Room[];
}

interface PropertyNote {
  id: string;
  content: string;
  noteType: string;
  photoUrl?: string | null;
  authorId: string;
  createdAt: string;
}

export function useProperties(params?: { status?: string; search?: string }) {
  return useQuery({
    queryKey: ["properties", params],
    queryFn: () =>
      api.get<Property[]>("/properties", {
        status: params?.status,
        search: params?.search,
      }),
  });
}

export function useProperty(id: string | undefined) {
  return useQuery({
    queryKey: ["properties", id],
    queryFn: () => api.get<Property>(`/properties/${id}`),
    enabled: !!id,
  });
}

export function useCreateProperty() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Property> & { name: string; code: string }) =>
      api.post<Property>("/properties", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["properties"] });
    },
  });
}

export function useUpdateProperty() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<Property>) =>
      api.patch<Property>(`/properties/${id}`, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["properties", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["properties"] });
    },
  });
}

export function usePropertyNotes(propertyId: string | undefined) {
  return useQuery({
    queryKey: ["properties", propertyId, "notes"],
    queryFn: () => api.get<PropertyNote[]>(`/properties/${propertyId}/notes`),
    enabled: !!propertyId,
  });
}

export function useAddPropertyNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      propertyId,
      ...data
    }: {
      propertyId: string;
      content: string;
      authorId: string;
      noteType?: string;
      photoUrl?: string;
    }) => api.post(`/properties/${propertyId}/notes`, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["properties", variables.propertyId, "notes"],
      });
    },
  });
}

export type { Property, PropertyOwner, Room, PropertyNote };
