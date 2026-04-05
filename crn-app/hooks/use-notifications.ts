import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { api } from "../services/api";

// ── Types ───────────────────────────────────────────────────────

interface Notification {
  id: string;
  title: string;
  body: string;
  entityType?: string | null;
  entityId?: string | null;
  isRead: boolean;
  readAt?: string | null;
  createdAt: string;
}

interface NotificationListResponse {
  notifications: Notification[];
  total: number;
  nextOffset: number | null;
}

interface UnreadCount {
  count: number;
}

interface OnboardingStatus {
  completed: boolean;
  completedAt?: string | null;
  dismissedTips: string[];
}

// ── Queries ─────────────────────────────────────────────────────

export function useNotifications(limit = 25) {
  return useInfiniteQuery({
    queryKey: ["notifications"],
    queryFn: ({ pageParam = 0 }) =>
      api.get<NotificationListResponse>("/notifications", {
        limit,
        offset: pageParam,
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextOffset ?? undefined,
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: () => api.get<UnreadCount>("/notifications/unread-count"),
    refetchInterval: 30_000, // poll every 30s
  });
}

// ── Mutations ───────────────────────────────────────────────────

export function useMarkRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.patch(`/notifications/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useMarkAllRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post("/notifications/mark-all-read"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useDismissNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/notifications/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useRegisterPushToken() {
  return useMutation({
    mutationFn: (data: { token: string; platform: string }) =>
      api.post("/push-tokens", data),
  });
}

// ── Onboarding ──────────────────────────────────────────────────

export function useOnboardingStatus() {
  return useQuery({
    queryKey: ["onboarding", "status"],
    queryFn: () => api.get<OnboardingStatus>("/onboarding/status"),
  });
}

export function useCompleteOnboarding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.patch("/onboarding/complete"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["onboarding"] });
    },
  });
}

export function useDismissTip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tipId: string) =>
      api.patch("/onboarding/dismiss-tip", { tipId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["onboarding"] });
    },
  });
}

export type { Notification, NotificationListResponse, UnreadCount, OnboardingStatus };
