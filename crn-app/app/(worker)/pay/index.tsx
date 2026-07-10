import { View, Text, ScrollView, StyleSheet, RefreshControl, ActivityIndicator, TouchableOpacity } from "react-native";
import { useState, useCallback } from "react";
import { useRouter } from "expo-router";
import { useWorkerPay } from "../../../hooks/use-worker";
import { ApiError } from "../../../services/api";
import { Card } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";

export default function WorkerPayScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const payQuery = useWorkerPay();

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await payQuery.refetch();
    setRefreshing(false);
  }, [payQuery]);

  const data = payQuery.data;

  // Distinct states: loading, no-open-period (404), other errors, data.
  const isNoOpenPeriod =
    payQuery.isError && payQuery.error instanceof ApiError && payQuery.error.status === 404;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.title}>My Pay</Text>

      {payQuery.isPending ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Loading your pay...</Text>
        </View>
      ) : isNoOpenPeriod ? (
        <EmptyState
          title="No open pay period"
          message="The current pay period has closed and the next one hasn't started yet. Your earnings will appear here once a new period opens."
        />
      ) : payQuery.isError ? (
        <EmptyState
          title="Couldn't load your pay"
          message="Check your connection and try again."
          actionLabel="Retry"
          onAction={() => payQuery.refetch()}
        />
      ) : !data ? (
        <EmptyState title="No pay data" message="Complete some jobs to see your earnings." />
      ) : (
        <>
          {/* Current Period Summary — tap for details + YTD */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => router.push(`/(worker)/pay/${data.periodId}`)}
          >
          <Card style={styles.summaryCard}>
            <View style={styles.periodHeaderRow}>
              <Text style={styles.periodLabel}>{data.periodLabel}</Text>
              <Text style={styles.chevron}>›</Text>
            </View>
            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{data.jobsWorked}</Text>
                <Text style={styles.statLabel}>Jobs Worked</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statValueLarge}>${data.totalEarned.toFixed(2)}</Text>
                <Text style={styles.statLabel}>Total Earned</Text>
              </View>
            </View>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: data.periodStatus === "paid" ? "#22c55e" : "#eab308" }]} />
              <Text style={styles.statusText}>
                {data.periodStatus === "paid" ? "Paid" : data.periodStatus === "closed" ? "Period closed — payment pending" : "Period open — payment pending"}
              </Text>
            </View>
          </Card>
          </TouchableOpacity>

          {/* Job-by-Job Breakdown */}
          <Text style={styles.sectionTitle}>Jobs This Period</Text>
          {data.jobs.length === 0 ? (
            <Text style={styles.emptyText}>No completed jobs this period</Text>
          ) : (
            data.jobs.map((job) => (
              <Card key={job.jobId} style={styles.jobCard}>
                <View style={styles.jobRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.jobDate}>{job.date}</Text>
                    <Text style={styles.jobProperty}>{job.propertyName}</Text>
                    <Text style={styles.jobType}>{job.jobType}</Text>
                  </View>
                  {/* ONLY shows "Your Pay" — single number, no breakdown */}
                  <View style={styles.payCol}>
                    <Text style={styles.payLabel}>Your Pay</Text>
                    <Text style={styles.payAmount}>${job.yourPay.toFixed(2)}</Text>
                  </View>
                </View>
              </Card>
            ))
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  content: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: "700", color: "#111827", marginBottom: 16 },
  centerBox: { alignItems: "center", paddingVertical: 48 },
  loadingText: { marginTop: 12, fontSize: 14, color: "#6b7280" },
  summaryCard: { marginBottom: 20 },
  periodHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  periodLabel: { fontSize: 18, fontWeight: "600", color: "#111827" },
  chevron: { fontSize: 22, color: "#d1d5db" },
  statsRow: { flexDirection: "row", gap: 20, marginBottom: 12 },
  stat: {},
  statValue: { fontSize: 24, fontWeight: "700", color: "#111827" },
  statValueLarge: { fontSize: 28, fontWeight: "700", color: "#16a34a" },
  statLabel: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 13, color: "#6b7280" },
  sectionTitle: { fontSize: 14, fontWeight: "600", color: "#6b7280", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 },
  emptyText: { fontSize: 14, color: "#9ca3af", fontStyle: "italic" },
  jobCard: { marginBottom: 6 },
  jobRow: { flexDirection: "row", alignItems: "center" },
  jobDate: { fontSize: 12, color: "#9ca3af" },
  jobProperty: { fontSize: 15, fontWeight: "500", color: "#111827" },
  jobType: { fontSize: 12, color: "#6b7280" },
  payCol: { alignItems: "flex-end" },
  payLabel: { fontSize: 11, color: "#9ca3af" },
  payAmount: { fontSize: 17, fontWeight: "700", color: "#111827" },
});
