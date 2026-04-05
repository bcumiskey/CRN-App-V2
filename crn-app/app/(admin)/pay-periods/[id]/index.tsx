import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Alert,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import {
  usePayPeriod,
  useClosePayPeriod,
  useReopenPayPeriod,
  useMarkPayPeriodPaid,
} from "../../../../hooks/use-pay-periods";
import { Card } from "../../../../components/ui/Card";
import { Button } from "../../../../components/ui/Button";
import { StatusBadge } from "../../../../components/ui/StatusBadge";

function fmt(n: number) {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function PayPeriodDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const periodQuery = usePayPeriod(id);
  const period = periodQuery.data;

  const closePeriod = useClosePayPeriod();
  const reopenPeriod = useReopenPayPeriod();
  const markPaid = useMarkPayPeriodPaid();

  const status = period?.status ?? "open";
  const isOpen = status === "open";
  const isClosed = status === "closed";
  const isPaid = status === "paid";

  const workers = period?.perWorker ?? [];
  const grandTotal = workers.reduce((sum, w) => sum + w.grossPay, 0);
  const totalJobs = workers.reduce((sum, w) => sum + w.jobsWorked, 0);

  const handleClose = () => {
    if (!id) return;
    Alert.alert(
      "Close Period & Generate Statements",
      "This will finalize all worker earnings for this period and generate pay statements. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Close Period",
          onPress: () =>
            closePeriod.mutate(id, { onSuccess: () => periodQuery.refetch() }),
        },
      ]
    );
  };

  const handleReopen = () => {
    if (!id) return;
    Alert.alert(
      "Reopen Period",
      "This will reopen the period for edits. Existing statements may need to be regenerated.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reopen",
          onPress: () =>
            reopenPeriod.mutate(id, { onSuccess: () => periodQuery.refetch() }),
        },
      ]
    );
  };

  const handleMarkPaid = () => {
    if (!id) return;
    Alert.alert(
      "Mark as Paid",
      "Confirm that all workers have been paid for this period?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Mark Paid",
          onPress: () =>
            markPaid.mutate(id, { onSuccess: () => periodQuery.refetch() }),
        },
      ]
    );
  };

  if (!period && periodQuery.isLoading) {
    return (
      <View style={styles.center}>
        <Text style={styles.loadingText}>Loading pay period...</Text>
      </View>
    );
  }

  if (!period) {
    return (
      <View style={styles.center}>
        <Text style={styles.loadingText}>Pay period not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={periodQuery.isRefetching} onRefresh={() => periodQuery.refetch()} />
        }
      >
        {/* Period Info */}
        <Card style={styles.section}>
          <View style={styles.infoHeader}>
            <Text style={styles.title}>Pay Period</Text>
            <StatusBadge status={status} size="md" />
          </View>
          <Text style={styles.dateRange}>
            {period.startDate} - {period.endDate}
          </Text>
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Workers</Text>
              <Text style={styles.metaValue}>{workers.length}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Total Jobs</Text>
              <Text style={styles.metaValue}>{totalJobs}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Gross Total</Text>
              <Text style={[styles.metaValue, { color: "#16a34a" }]}>{fmt(grandTotal)}</Text>
            </View>
          </View>
          {period.closedAt && (
            <Text style={styles.timestampText}>Closed: {period.closedAt}</Text>
          )}
          {period.paidAt && (
            <Text style={styles.timestampText}>Paid: {period.paidAt}</Text>
          )}
        </Card>

        {/* Worker Breakdown */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Per-Worker Breakdown</Text>

          {workers.length === 0 ? (
            <Text style={styles.emptyText}>No workers in this period.</Text>
          ) : (
            <>
              {/* Table Header */}
              <View style={styles.tableHeader}>
                <Text style={[styles.thCell, styles.thName]}>Name</Text>
                <Text style={[styles.thCell, styles.thNum]}>Jobs</Text>
                <Text style={[styles.thCell, styles.thNum]}>Shares</Text>
                <Text style={[styles.thCell, styles.thAmount]}>Pool Pay</Text>
                <Text style={[styles.thCell, styles.thAmount]}>Owner</Text>
                <Text style={[styles.thCell, styles.thAmount]}>Gross</Text>
              </View>

              {/* Table Rows */}
              {workers.map((w) => (
                <View key={w.userId} style={styles.tableRow}>
                  <Text style={[styles.tdCell, styles.tdName]} numberOfLines={1}>
                    {w.userName}
                  </Text>
                  <Text style={[styles.tdCell, styles.tdNum]}>{w.jobsWorked}</Text>
                  <Text style={[styles.tdCell, styles.tdNum]}>{w.totalShares}</Text>
                  <Text style={[styles.tdCell, styles.tdAmount]}>{fmt(w.workerPoolPay)}</Text>
                  <Text style={[styles.tdCell, styles.tdAmount]}>{fmt(w.ownerPay)}</Text>
                  <Text style={[styles.tdCell, styles.tdAmountBold]}>{fmt(w.grossPay)}</Text>
                </View>
              ))}

              {/* Totals Row */}
              <View style={[styles.tableRow, styles.totalRow]}>
                <Text style={[styles.tdCell, styles.tdName, { fontWeight: "700" }]}>Total</Text>
                <Text style={[styles.tdCell, styles.tdNum, { fontWeight: "700" }]}>{totalJobs}</Text>
                <Text style={[styles.tdCell, styles.tdNum, { fontWeight: "700" }]}>
                  {workers.reduce((s, w) => s + w.totalShares, 0)}
                </Text>
                <Text style={[styles.tdCell, styles.tdAmount, { fontWeight: "700" }]}>
                  {fmt(workers.reduce((s, w) => s + w.workerPoolPay, 0))}
                </Text>
                <Text style={[styles.tdCell, styles.tdAmount, { fontWeight: "700" }]}>
                  {fmt(workers.reduce((s, w) => s + w.ownerPay, 0))}
                </Text>
                <Text style={[styles.tdCell, styles.tdAmountBold]}>
                  {fmt(grandTotal)}
                </Text>
              </View>
            </>
          )}
        </Card>

        {/* Actions */}
        <View style={styles.actions}>
          {isOpen && (
            <Button
              onPress={handleClose}
              variant="primary"
              size="lg"
              fullWidth
              loading={closePeriod.isPending}
            >
              Close Period & Generate Statements
            </Button>
          )}
          {isClosed && (
            <>
              <Button
                onPress={handleMarkPaid}
                variant="success"
                size="lg"
                fullWidth
                loading={markPaid.isPending}
              >
                Mark as Paid
              </Button>
              <Button
                onPress={handleReopen}
                variant="outline"
                size="md"
                fullWidth
                loading={reopenPeriod.isPending}
              >
                Reopen Period
              </Button>
            </>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { fontSize: 15, color: "#6b7280" },
  content: { padding: 16 },
  section: { marginBottom: 16 },
  infoHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  title: { fontSize: 20, fontWeight: "700", color: "#111827" },
  dateRange: { fontSize: 15, color: "#374151", marginBottom: 12 },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
    paddingTop: 12,
  },
  metaItem: { alignItems: "center" },
  metaLabel: { fontSize: 11, color: "#9ca3af", marginBottom: 2 },
  metaValue: { fontSize: 18, fontWeight: "700", color: "#111827" },
  timestampText: { fontSize: 12, color: "#9ca3af", marginTop: 8 },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 12,
  },
  emptyText: { fontSize: 13, color: "#9ca3af", textAlign: "center", paddingVertical: 16 },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    paddingBottom: 8,
    marginBottom: 4,
  },
  thCell: { fontSize: 11, fontWeight: "600", color: "#6b7280" },
  thName: { flex: 2 },
  thNum: { flex: 1, textAlign: "center" },
  thAmount: { flex: 1.5, textAlign: "right" },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f9fafb",
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    borderBottomWidth: 0,
    marginTop: 4,
    paddingTop: 10,
  },
  tdCell: { fontSize: 13, color: "#374151" },
  tdName: { flex: 2 },
  tdNum: { flex: 1, textAlign: "center" },
  tdAmount: { flex: 1.5, textAlign: "right" },
  tdAmountBold: { flex: 1.5, textAlign: "right", fontWeight: "700", color: "#111827" },
  actions: { gap: 10, marginTop: 8 },
});
