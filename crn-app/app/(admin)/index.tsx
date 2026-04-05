import { View, Text, ScrollView, StyleSheet, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { useState, useCallback } from "react";
import { useTodayJobs, useDashboardStats } from "../../hooks/use-dashboard";
import { JobCard } from "../../components/domain/JobCard";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";

export default function DashboardScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const todayQuery = useTodayJobs();
  const statsQuery = useDashboardStats();

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([todayQuery.refetch(), statsQuery.refetch()]);
    setRefreshing(false);
  }, [todayQuery, statsQuery]);

  const today = new Date();
  const greeting = today.getHours() < 12 ? "Good morning" : today.getHours() < 17 ? "Good afternoon" : "Good evening";
  const dateStr = today.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  const jobs = todayQuery.data?.jobs ?? [];
  const stats = statsQuery.data;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header */}
      <Text style={styles.greeting}>{greeting}</Text>
      <Text style={styles.dateLabel}>{dateStr}</Text>

      {/* Quick Stats */}
      {stats && (
        <View style={styles.statsRow}>
          <StatCard
            label="Jobs This Month"
            value={`${stats.jobsCompleted}/${stats.jobsThisMonth}`}
          />
          <StatCard
            label="Revenue"
            value={`$${stats.revenueThisMonth.toLocaleString()}`}
          />
          <StatCard
            label="Outstanding"
            value={`$${stats.outstandingAmount.toLocaleString()}`}
          />
        </View>
      )}

      {/* Today's Jobs */}
      <Text style={styles.sectionTitle}>
        Today {jobs.length > 0 ? `(${jobs.length})` : ""}
      </Text>

      {jobs.length === 0 ? (
        <EmptyState
          title="No jobs today"
          message="Enjoy your day off! Tap + to add a job."
        />
      ) : (
        jobs.map((job) => (
          <JobCard
            key={job.id}
            jobNumber={job.jobNumber}
            propertyName={job.property.name}
            scheduledDate={job.scheduledDate}
            scheduledTime={job.scheduledTime}
            jobType={job.jobType}
            status={job.status}
            totalFee={job.totalFee}
            isBtoB={job.isBtoB}
            crew={job.assignments.map((a) => ({
              name: a.user.name,
              share: a.share,
            }))}
            onPress={() => router.push(`/(admin)/jobs/${job.id}`)}
          />
        ))
      )}
    </ScrollView>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  content: { padding: 16 },
  greeting: { fontSize: 24, fontWeight: "700", color: "#111827" },
  dateLabel: { fontSize: 14, color: "#6b7280", marginBottom: 20 },
  statsRow: { flexDirection: "row", gap: 8, marginBottom: 24 },
  statCard: { flex: 1, alignItems: "center", paddingVertical: 12, paddingHorizontal: 8 },
  statValue: { fontSize: 18, fontWeight: "700", color: "#111827" },
  statLabel: { fontSize: 11, color: "#6b7280", marginTop: 2, textAlign: "center" },
  sectionTitle: { fontSize: 16, fontWeight: "600", color: "#111827", marginBottom: 12 },
});
