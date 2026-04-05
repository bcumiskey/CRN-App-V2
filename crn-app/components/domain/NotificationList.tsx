import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useMemo, useCallback } from "react";
import { Swipeable } from "react-native-gesture-handler";
import { Trash2 } from "lucide-react-native";
import {
  useNotifications,
  useMarkRead,
  useMarkAllRead,
  useDismissNotification,
  type Notification,
} from "../../hooks/use-notifications";
import { EmptyState } from "../ui/EmptyState";
import { Button } from "../ui/Button";

// ── Helpers ─────────────────────────────────────────────────────

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function dayGroup(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return "Older";
}

type GroupedItem =
  | { type: "header"; title: string }
  | { type: "notification"; data: Notification };

interface NotificationListProps {
  routePrefix: "(admin)" | "(worker)";
}

export function NotificationList({ routePrefix }: NotificationListProps) {
  const router = useRouter();
  const notificationsQuery = useNotifications();
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();
  const dismiss = useDismissNotification();

  const allNotifications = useMemo(() => {
    if (!notificationsQuery.data) return [];
    return notificationsQuery.data.pages.flatMap((page) => page.notifications);
  }, [notificationsQuery.data]);

  const groupedData = useMemo<GroupedItem[]>(() => {
    if (allNotifications.length === 0) return [];
    const items: GroupedItem[] = [];
    let lastGroup = "";
    for (const n of allNotifications) {
      const group = dayGroup(n.createdAt);
      if (group !== lastGroup) {
        items.push({ type: "header", title: group });
        lastGroup = group;
      }
      items.push({ type: "notification", data: n });
    }
    return items;
  }, [allNotifications]);

  const handleTap = useCallback(
    (notification: Notification) => {
      if (!notification.isRead) {
        markRead.mutate(notification.id);
      }
      if (notification.entityType && notification.entityId) {
        const entityRoutes: Record<string, string> = {
          job: `/${routePrefix}/jobs/${notification.entityId}`,
          invoice: `/${routePrefix}/invoices/${notification.entityId}`,
          property: `/${routePrefix}/properties/${notification.entityId}`,
        };
        const route = entityRoutes[notification.entityType];
        if (route) {
          router.push(route as never);
        }
      }
    },
    [markRead, router, routePrefix]
  );

  const handleDismiss = useCallback(
    (id: string) => {
      dismiss.mutate(id);
    },
    [dismiss]
  );

  const handleMarkAllRead = useCallback(() => {
    markAllRead.mutate();
  }, [markAllRead]);

  const renderSwipeRight = useCallback(
    (id: string) => () => (
      <TouchableOpacity
        style={styles.swipeDelete}
        onPress={() => handleDismiss(id)}
      >
        <Trash2 size={20} color="#ffffff" />
      </TouchableOpacity>
    ),
    [handleDismiss]
  );

  const renderItem = useCallback(
    ({ item }: { item: GroupedItem }) => {
      if (item.type === "header") {
        return (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderText}>{item.title}</Text>
          </View>
        );
      }

      const n = item.data;
      return (
        <Swipeable renderRightActions={renderSwipeRight(n.id)}>
          <TouchableOpacity
            style={[styles.notificationRow, !n.isRead && styles.unreadRow]}
            onPress={() => handleTap(n)}
            activeOpacity={0.7}
          >
            {!n.isRead && <View style={styles.unreadDot} />}
            <View style={[styles.notificationContent, n.isRead && styles.readPadding]}>
              <View style={styles.notificationHeader}>
                <Text
                  style={[styles.notificationTitle, !n.isRead && styles.unreadTitle]}
                  numberOfLines={1}
                >
                  {n.title}
                </Text>
                <Text style={styles.notificationTime}>{relativeTime(n.createdAt)}</Text>
              </View>
              <Text style={styles.notificationBody} numberOfLines={2}>
                {n.body}
              </Text>
            </View>
          </TouchableOpacity>
        </Swipeable>
      );
    },
    [handleTap, renderSwipeRight]
  );

  const keyExtractor = useCallback(
    (item: GroupedItem, index: number) =>
      item.type === "header" ? `header-${item.title}` : `notif-${item.data.id}`,
    []
  );

  const hasUnread = allNotifications.some((n) => !n.isRead);

  return (
    <View style={styles.container}>
      {hasUnread && (
        <View style={styles.markAllContainer}>
          <Button variant="ghost" size="sm" onPress={handleMarkAllRead} loading={markAllRead.isPending}>
            Mark All Read
          </Button>
        </View>
      )}
      <FlatList
        data={groupedData}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={
          groupedData.length === 0 ? styles.emptyContainer : styles.listContent
        }
        ListEmptyComponent={
          <EmptyState
            title="No notifications"
            message="You're all caught up! Notifications about jobs, invoices, and schedule changes will appear here."
          />
        }
        refreshControl={
          <RefreshControl
            refreshing={notificationsQuery.isRefetching}
            onRefresh={() => notificationsQuery.refetch()}
            tintColor="#2563eb"
          />
        }
        onEndReached={() => {
          if (notificationsQuery.hasNextPage && !notificationsQuery.isFetchingNextPage) {
            notificationsQuery.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.3}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  markAllContainer: {
    alignItems: "flex-end",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  listContent: {
    paddingBottom: 32,
  },
  emptyContainer: {
    flex: 1,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 6,
  },
  sectionHeaderText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  notificationRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#ffffff",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  unreadRow: {
    backgroundColor: "#eff6ff",
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#2563eb",
    marginTop: 6,
    marginRight: 10,
  },
  notificationContent: {
    flex: 1,
  },
  readPadding: {
    paddingLeft: 18, // align with unread that has the dot
  },
  notificationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  notificationTitle: {
    fontSize: 15,
    color: "#374151",
    flex: 1,
    marginRight: 8,
  },
  unreadTitle: {
    fontWeight: "600",
    color: "#111827",
  },
  notificationTime: {
    fontSize: 12,
    color: "#9ca3af",
  },
  notificationBody: {
    fontSize: 13,
    color: "#6b7280",
    lineHeight: 18,
  },
  swipeDelete: {
    backgroundColor: "#dc2626",
    justifyContent: "center",
    alignItems: "center",
    width: 72,
  },
});
