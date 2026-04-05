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
import { useMemo } from "react";
import {
  usePayPeriods,
  useCreatePayPeriod,
  useClosePayPeriod,
} from "../../../hooks/use-pay-periods";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { EmptyState } from "../../../components/ui/EmptyState";

function fmt(n: number) {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDateRange(start: string, end: string) {
  return `${start} - ${end}`;
}

export default function PayPeriodsScreen() {
  const router = useRouter();
  const payPeriodsQuery = usePayPeriods();
  const payPeriods = payPeriodsQuery.data ?? [];
  const createPayPeriod = useCreatePayPeriod();
  const closePayPeriod = useClosePayPeriod();

  // Separate current (open) from previous
  const { current, previous } = useMemo(() => {
    const open = payPeriods.find((pp) => pp.status === "open");
    const rest = payPeriods.filter((pp) => pp.id !== open?.id);
    return { current: open, previous: rest };
  }, [payPeriods]);

  const handleNewPeriod = () => {
    createPayPeriod.mutate(undefined, {
      onSuccess: () => payPeriodsQuery.refetch(),
      onError: (err: any) => Alert.alert("Error", err?.message ?? "Failed to create pay period."),
    });
  };

  const handleClosePeriod = (id: string) => {
    Alert.alert(
      "Close Period",
      "This will close the current pay period and generate statements. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Close",
          onPress: () =>
            closePayPeriod.mutate(id, {
              onSuccess: () => payPeriodsQuery.refetch(),
              onError: (err: any) => Alert.alert("Error", err?.message ?? "Failed to close period."),
            }),
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={previous}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={payPeriodsQuery.isRefetching}
            onRefresh={() => payPeriodsQuery.refetch()}
          />
        }
        ListHeaderComponent={
          <>
            {/* Current Period Card */}
            {current ? (
              <Card style={styles.currentCard}>
                <View style={styles.currentHeader}>
                  <Text style={styles.currentTitle}>Current Period</Text>
                  <StatusBadge status={current.status} size="md" />
                </View>
                <Text style={styles.currentRange}>
                  {formatDateRange(current.startDate, current.endDate)}
                </Text>
                {current.perWorker && current.perWorker.length > 0 && (
                  <Text style={styles.currentWorkers}>
                    {current.perWorker.length} worker{current.perWorker.length !== 1 ? "s" : ""}
                    {" | "}
                    {current.perWorker.reduce((sum, w) => sum + w.jobsWorked, 0)} jobs
                  </Text>
                )}
                <View style={styles.currentActions}>
                  <Button
                    onPress={() => router.push(`/(admin)/pay-periods/${current.id}`)}
                    variant="outline"
                    size="sm"
                  >
                    View Details
                  </Button>
                  <Button
                    onPress={() => handleClosePeriod(current.id)}
                    variant="primary"
                    size="sm"
                    loading={closePayPeriod.isPending}
                  >
                    Close Period
                  </Button>
                </View>
              </Card>
            ) : (
              <Card style={styles.currentCard}>
                <Text style={styles.noCurrentTitle}>No Open Period</Text>
                <Text style={styles.noCurrentText}>
                  Create a new pay period to start tracking worker earnings.
                </Text>
                <Button
                  onPress={handleNewPeriod}
                  variant="primary"
                  size="md"
                  loading={createPayPeriod.isPending}
                >
                  + New Period
                </Button>
              </Card>
            )}

            {/* New Period Button (when current exists) */}
            {current && (
              <View style={styles.actionRow}>
                <Button
                  onPress={handleNewPeriod}
                  variant="outline"
                  size="sm"
                  loading={createPayPeriod.isPending}
                >
                  + New Period
                </Button>
              </View>
            )}

            {previous.length > 0 && (
              <Text style={styles.previousTitle}>Previous Periods</Text>
            )}
          </>
        }
        renderItem={({ item }) => {
          const totalPaid = item.perWorker
            ? item.perWorker.reduce((sum, w) => sum + w.grossPay, 0)
            : 0;
          const workerCount = item.perWorker?.length ?? 0;

          return (
            <TouchableOpacity onPress={() => router.push(`/(admin)/pay-periods/${item.id}`)}>
              <Card style={styles.periodCard}>
                <View style={styles.periodTop}>
                  <Text style={styles.periodRange}>
                    {formatDateRange(item.startDate, item.endDate)}
                  </Text>
                  <StatusBadge status={item.status} size="sm" />
                </View>
                <View style={styles.periodBottom}>
                  <Text style={styles.periodDetail}>
                    {workerCount} worker{workerCount !== 1 ? "s" : ""}
                  </Text>
                  <Text style={styles.periodTotal}>{fmt(totalPaid)}</Text>
                </View>
              </Card>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          payPeriodsQuery.isLoading || current ? null : (
            <EmptyState
              title="No pay periods"
              message="Create your first pay period to track worker compensation."
              actionLabel="Create Period"
              onAction={handleNewPeriod}
            />
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  list: { padding: 16 },
  currentCard: {
    marginBottom: 16,
    borderWidth: 2,
    borderColor: "#dbeafe",
  },
  currentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  currentTitle: { fontSize: 17, fontWeight: "700", color: "#111827" },
  currentRange: { fontSize: 15, color: "#374151", marginBottom: 4 },
  currentWorkers: { fontSize: 13, color: "#6b7280", marginBottom: 12 },
  currentActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  noCurrentTitle: { fontSize: 17, fontWeight: "600", color: "#111827", marginBottom: 4 },
  noCurrentText: { fontSize: 13, color: "#6b7280", marginBottom: 12, lineHeight: 18 },
  actionRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 16,
  },
  previousTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#6b7280",
    marginBottom: 10,
  },
  periodCard: { marginBottom: 8 },
  periodTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  periodRange: { fontSize: 14, fontWeight: "600", color: "#111827" },
  periodBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  periodDetail: { fontSize: 13, color: "#6b7280" },
  periodTotal: { fontSize: 16, fontWeight: "700", color: "#111827" },
});
