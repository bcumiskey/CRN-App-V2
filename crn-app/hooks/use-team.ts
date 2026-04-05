import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../services/api";

interface TeamMember {
  id: string;
  clerkId: string;
  email: string;
  name: string;
  phone?: string | null;
  role: string;
  isOwner: boolean;
  status: string;
  statusChangedAt?: string | null;
  statusReason?: string | null;
  defaultShare: number;
  avatarUrl?: string | null;
}

interface TeamMemberDetail extends TeamMember {
  recentAssignments?: Array<{
    id: string;
    share: number;
    job: { id: string; scheduledDate: string; property: { name: string }; status: string };
  }>;
  totalJobs?: number;
}

export function useTeam(params?: { status?: string }) {
  return useQuery({
    queryKey: ["team", params],
    queryFn: () =>
      api.get<TeamMember[]>("/team", {
        status: params?.status,
      }),
  });
}

export function useTeamMember(id: string | undefined) {
  return useQuery({
    queryKey: ["team", id],
    queryFn: () => api.get<TeamMemberDetail>(`/team/${id}`),
    enabled: !!id,
  });
}

export function useCreateTeamMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string;
      email: string;
      phone?: string;
      role?: string;
      defaultShare?: number;
      isOwner?: boolean;
    }) => api.post<TeamMember>("/team", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team"] });
    },
  });
}

export function useUpdateTeamMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<TeamMember>) =>
      api.patch<TeamMember>(`/team/${id}`, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["team", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["team"] });
    },
  });
}

/**
 * Returns only active team members — for crew picker in Quick Add / Job Detail.
 */
export function useActiveTeam() {
  return useTeam({ status: "active" });
}

export type { TeamMember, TeamMemberDetail };
