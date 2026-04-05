import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { useState, useCallback } from "react";
import { useJobs } from "../../../hooks/use-jobs";
import { useFilterStore } from "../../../stores/filter-store";
import { JobCard } from "../../../components/domain/JobCard";
import { EmptyState } from "../../../components/ui/EmptyState";

const statusOptions = ["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"];

export default function JobsScreen() {
  const router = useRouter();
  const { jobFilters, setJobFilters } = useFilterStore();
  const [refreshing, setRefreshing] = useState(false);

  const jobsQuery = useJobs({
    status: jobFilters.status,
    propertyId: jobFilters.propertyId,
    startDate: jobFilters.startDate,
    endDate: jobFilters.endDate,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await jobsQuery.refetch();
    setRefreshing(false);
  }, [jobsQuery]);

  const toggleStatus = (status: string) => {
    const current = jobFilters.status ?? [];
    const updated = current.includes(status)
      ? current.filter((s) => s !== status)
      : [...current, status];
    setJobFilters({ status: updated.length > 0 ? updated : [] });
  };

  const jobs = jobsQuery.data?.jobs ?? [];

  return (
    <View style={styles.container}>
      {/* Filter pills */}
      <View style={styles.filterRow}>
        {statusOptions.map((status) => {
          const isActive = (jobFilters.status ?? []).includes(status);
          return (
            <TouchableOpacity
              key={status}
              onPress={() => toggleStatus(status)}
              style={[styles.filterPill, isActive && styles.filterPillActive]}
            >
              <Text style={[styles.filterText, isActive && styles.filterTextActive]}>
                {status.replace("_", " ")}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Jobs list */}
      <FlatList
        data={jobs}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        renderItem={({ item }) => (
          <JobCard
            jobNumber={item.jobNumber}
            propertyName={item.property.name}
            scheduledDate={item.scheduledDate}
            scheduledTime={item.scheduledTime}
            jobType={item.jobType}
            status={item.status}
            totalFee={item.totalFee}
            isBtoB={item.isBtoB}
            crew={item.assignments.map((a) => ({
              name: a.user.name,
              share: a.share,
            }))}
            onPress={() => router.push(`/(admin)/jobs/${item.id}`)}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            title="No jobs found"
            message="Tap + to create your first job."
            actionLabel="Add Job"
            onAction={() => router.push("/(admin)/quick-add")}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  filterRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#f3f4f6",
  },
  filterPillActive: {
    backgroundColor: "#dbeafe",
  },
  filterText: { fontSize: 12, fontWeight: "500", color: "#6b7280" },
  filterTextActive: { color: "#2563eb" },
  list: { padding: 16 },
});
