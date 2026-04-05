import { View, Text, ScrollView, TouchableOpacity, Linking, StyleSheet, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { useState, useCallback } from "react";
import { useWorkerTodayJobs, useWorkerUpdateJobStatus } from "../../hooks/use-worker";
import { Card } from "../../components/ui/Card";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { EmptyState } from "../../components/ui/EmptyState";
import { Button } from "../../components/ui/Button";

export default function WorkerTodayScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const todayQuery = useWorkerTodayJobs();
  const updateStatus = useWorkerUpdateJobStatus();

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await todayQuery.refetch();
    setRefreshing(false);
  }, [todayQuery]);

  const today = new Date();
  const dateStr = today.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const jobs = todayQuery.data?.jobs ?? [];
  const allDone = jobs.length > 0 && jobs.every((j) => j.status === "COMPLETED");

  const handleDirections = (address?: string | null) => {
    if (!address) return;
    const url = `https://maps.google.com/?q=${encodeURIComponent(address)}`;
    Linking.openURL(url);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.dateHeader}>Today — {dateStr}</Text>

      {jobs.length === 0 ? (
        <EmptyState
          title="No jobs today"
          message="Enjoy your day off!"
        />
      ) : allDone ? (
        <EmptyState
          title="All done for today ✓"
          message="Great work! All jobs are completed."
        />
      ) : (
        jobs.map((job) => (
          <TouchableOpacity
            key={job.id}
            onPress={() => router.push(`/(worker)/jobs/${job.id}`)}
            activeOpacity={0.7}
          >
            <Card style={styles.jobCard}>
              {/* Status + time */}
              <View style={styles.topRow}>
                <StatusBadge status={job.status} size="md" />
                {job.scheduledTime && (
                  <Text style={styles.time}>{job.scheduledTime}</Text>
                )}
              </View>

              {/* Property name */}
              <Text style={styles.propertyName}>{job.property.name}</Text>
              <Text style={styles.jobType}>{job.jobType}</Text>

              {/* B2B badge */}
              {job.isBtoB && (
                <View style={styles.btobBadge}>
                  <Text style={styles.btobText}>B2B — Back to Back</Text>
                </View>
              )}

              {/* Crew — names only, NO shares, NO pay */}
              {job.assignments.length > 0 && (
                <View style={styles.crewRow}>
                  {job.assignments.map((a, i) => (
                    <View key={i} style={styles.crewChip}>
                      <Text style={styles.crewName}>{a.userName}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Quick actions */}
              <View style={styles.actionRow}>
                {job.property.address && (
                  <Button
                    variant="outline"
                    size="sm"
                    onPress={() => handleDirections(job.property.address)}
                  >
                    📍 Directions
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onPress={() => router.push(`/(worker)/properties/${job.propertyId}`)}
                >
                  🏠 Property
                </Button>
              </View>

              {/* NO FEE, NO FINANCIAL DATA ANYWHERE */}
            </Card>
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  content: { padding: 16 },
  dateHeader: { fontSize: 18, fontWeight: "600", color: "#111827", marginBottom: 16 },
  jobCard: { marginBottom: 12 },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  time: { fontSize: 15, fontWeight: "500", color: "#374151" },
  propertyName: { fontSize: 20, fontWeight: "700", color: "#111827", marginBottom: 2 },
  jobType: { fontSize: 14, color: "#6b7280", marginBottom: 8 },
  btobBadge: { backgroundColor: "#fff7ed", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, alignSelf: "flex-start", marginBottom: 8 },
  btobText: { fontSize: 13, fontWeight: "600", color: "#ea580c" },
  crewRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  crewChip: { backgroundColor: "#f3f4f6", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  crewName: { fontSize: 13, color: "#374151", fontWeight: "500" },
  actionRow: { flexDirection: "row", gap: 8 },
});
