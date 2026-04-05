import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import {
  useCalendarSources,
  useSyncAll,
  useUnmatchedEvents,
} from "../../../hooks/use-calendar-sync";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { EmptyState } from "../../../components/ui/EmptyState";

function timeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return "Never";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function intervalLabel(minutes: number): string {
  if (minutes <= 0) return "Manual only";
  if (minutes < 60) return `Every ${minutes}m`;
  if (minutes === 60) return "Hourly";
  if (minutes < 1440) return `Every ${minutes / 60}h`;
  return "Daily";
}

const TYPE_LABELS: Record<string, string> = {
  turno_ical: "Turno iCal",
  google_ical: "Google iCal",
};

export default function CalendarSyncScreen() {
  const router = useRouter();
  const sourcesQuery = useCalendarSources();
  const sources = sourcesQuery.data ?? [];
  const syncAll = useSyncAll();
  const unmatchedQuery = useUnmatchedEvents();
  const unmatchedCount = unmatchedQuery.data?.length ?? 0;

  return (
    <View style={styles.container}>
      {/* Header actions */}
      <View style={styles.headerRow}>
        <Button
          onPress={() => syncAll.mutate()}
          variant="primary"
          size="md"
          loading={syncAll.isPending}
        >
          Sync All Now
        </Button>
        <Button
          onPress={() => router.push("/(admin)/calendar-sync/add")}
          variant="outline"
          size="md"
        >
          + Add Source
        </Button>
      </View>

      {/* Unmatched events banner */}
      {unmatchedCount > 0 && (
        <TouchableOpacity
          style={styles.unmatchedBanner}
          onPress={() => router.push("/(admin)/calendar-sync/unmatched")}
          activeOpacity={0.7}
        >
          <Text style={styles.unmatchedText}>
            {unmatchedCount} unmatched event{unmatchedCount !== 1 ? "s" : ""} need review
          </Text>
          <Text style={styles.unmatchedChevron}>{">"}</Text>
        </TouchableOpacity>
      )}

      <FlatList
        data={sources}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={sourcesQuery.isRefetching}
            onRefresh={() => {
              sourcesQuery.refetch();
              unmatchedQuery.refetch();
            }}
          />
        }
        renderItem={({ item }) => {
          const syncStatus = item.lastSyncStatus;
          const statusIcon =
            syncStatus === "success"
              ? "\u2713"
              : syncStatus === "error"
              ? "\u2717"
              : syncStatus === "partial"
              ? "\u26A0"
              : "\u2014";
          const statusColor =
            syncStatus === "success"
              ? "#16a34a"
              : syncStatus === "error"
              ? "#dc2626"
              : syncStatus === "partial"
              ? "#ca8a04"
              : "#9ca3af";

          return (
            <TouchableOpacity
              onPress={() => router.push(`/(admin)/calendar-sync/${item.id}`)}
              activeOpacity={0.7}
            >
              <Card style={styles.sourceCard}>
                <View style={styles.cardTopRow}>
                  <View style={styles.cardTitleArea}>
                    <Text style={styles.sourceName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <View style={styles.typeBadge}>
                      <Text style={styles.typeBadgeText}>
                        {TYPE_LABELS[item.type] ?? item.type}
                      </Text>
                    </View>
                  </View>
                  {!item.isActive && (
                    <View style={styles.inactiveBadge}>
                      <Text style={styles.inactiveBadgeText}>Inactive</Text>
                    </View>
                  )}
                </View>

                <Text style={styles.propertyLabel}>
                  {item.property ? item.property.name : "Multi-property"}
                </Text>

                <View style={styles.cardBottomRow}>
                  <View style={styles.syncStatusRow}>
                    <Text style={[styles.statusIcon, { color: statusColor }]}>
                      {statusIcon}
                    </Text>
                    <Text style={styles.syncTime}>
                      {timeAgo(item.lastSyncAt)}
                    </Text>
                  </View>
                  <Text style={styles.intervalText}>
                    {intervalLabel(item.syncIntervalMinutes)}
                  </Text>
                </View>
              </Card>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          sourcesQuery.isLoading ? (
            <ActivityIndicator
              size="large"
              color="#2563eb"
              style={{ marginTop: 48 }}
            />
          ) : (
            <EmptyState
              title="No calendar sources"
              message="Connect an iCal feed to automatically import cleaning jobs from Turno, Google Calendar, or other platforms."
              actionLabel="Add Source"
              onAction={() => router.push("/(admin)/calendar-sync/add")}
            />
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  unmatchedBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fef3c7",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#fde68a",
  },
  unmatchedText: { fontSize: 13, fontWeight: "600", color: "#92400e" },
  unmatchedChevron: { fontSize: 16, color: "#92400e" },
  list: { padding: 16 },
  sourceCard: { marginBottom: 10 },
  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  cardTitleArea: { flexDirection: "row", alignItems: "center", flex: 1, gap: 8 },
  sourceName: { fontSize: 16, fontWeight: "600", color: "#111827", flexShrink: 1 },
  typeBadge: {
    backgroundColor: "#ede9fe",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  typeBadgeText: { fontSize: 11, fontWeight: "600", color: "#7c3aed" },
  inactiveBadge: {
    backgroundColor: "#f3f4f6",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  inactiveBadgeText: { fontSize: 11, fontWeight: "500", color: "#9ca3af" },
  propertyLabel: { fontSize: 13, color: "#6b7280", marginBottom: 8 },
  cardBottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
    paddingTop: 8,
  },
  syncStatusRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  statusIcon: { fontSize: 14, fontWeight: "700" },
  syncTime: { fontSize: 12, color: "#6b7280" },
  intervalText: { fontSize: 12, color: "#9ca3af" },
});
