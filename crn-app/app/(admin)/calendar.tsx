import { View, Text, FlatList, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useState, useMemo } from "react";
import { useJobs } from "../../hooks/use-jobs";
import { JobCard } from "../../components/domain/JobCard";
import { EmptyState } from "../../components/ui/EmptyState";

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export default function CalendarScreen() {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(() => formatDate(new Date()));
  const [weekStart, setWeekStart] = useState(() => {
    const now = new Date();
    const day = now.getDay();
    return addDays(now, -day);
  });

  // Fetch jobs for the visible week
  const startDate = formatDate(weekStart);
  const endDate = formatDate(addDays(weekStart, 6));
  const jobsQuery = useJobs({ startDate, endDate, status: ["SCHEDULED", "IN_PROGRESS", "COMPLETED"] });
  const jobs = jobsQuery.data?.jobs ?? [];

  // Group by date
  const jobsByDate = useMemo(() => {
    const map: Record<string, typeof jobs> = {};
    for (const job of jobs) {
      if (!map[job.scheduledDate]) map[job.scheduledDate] = [];
      map[job.scheduledDate].push(job);
    }
    return map;
  }, [jobs]);

  // Generate week days
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(weekStart, i);
      const dateStr = formatDate(date);
      return {
        date: dateStr,
        dayName: date.toLocaleDateString("en-US", { weekday: "short" }),
        dayNum: date.getDate(),
        isToday: dateStr === formatDate(new Date()),
        jobCount: (jobsByDate[dateStr] ?? []).length,
      };
    });
  }, [weekStart, jobsByDate]);

  const selectedJobs = jobsByDate[selectedDate] ?? [];

  return (
    <View style={styles.container}>
      {/* Week navigation */}
      <View style={styles.weekNav}>
        <Text
          style={styles.navArrow}
          onPress={() => setWeekStart(addDays(weekStart, -7))}
        >
          ←
        </Text>
        <Text style={styles.weekLabel}>
          {weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} — {addDays(weekStart, 6).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </Text>
        <Text
          style={styles.navArrow}
          onPress={() => setWeekStart(addDays(weekStart, 7))}
        >
          →
        </Text>
      </View>

      {/* Week strip */}
      <View style={styles.weekStrip}>
        {weekDays.map((day) => (
          <View
            key={day.date}
            style={[
              styles.dayCell,
              day.date === selectedDate && styles.dayCellSelected,
              day.isToday && styles.dayCellToday,
            ]}
            onTouchEnd={() => setSelectedDate(day.date)}
          >
            <Text style={[styles.dayName, day.date === selectedDate && styles.dayTextSelected]}>
              {day.dayName}
            </Text>
            <Text style={[styles.dayNum, day.date === selectedDate && styles.dayTextSelected]}>
              {day.dayNum}
            </Text>
            {day.jobCount > 0 && (
              <View style={styles.dotRow}>
                {Array.from({ length: Math.min(day.jobCount, 3) }, (_, i) => (
                  <View key={i} style={styles.dot} />
                ))}
              </View>
            )}
          </View>
        ))}
      </View>

      {/* Selected day's jobs */}
      <FlatList
        data={selectedJobs}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.jobList}
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
            compact
            crew={item.assignments.map((a) => ({
              name: a.user.name,
              share: a.share,
            }))}
            onPress={() => router.push(`/(admin)/jobs/${item.id}`)}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            title="No jobs"
            message={`No jobs scheduled for ${new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}`}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  weekNav: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#ffffff",
  },
  navArrow: { fontSize: 20, color: "#2563eb", padding: 8 },
  weekLabel: { fontSize: 15, fontWeight: "600", color: "#111827" },
  weekStrip: {
    flexDirection: "row",
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    paddingBottom: 12,
  },
  dayCell: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    borderRadius: 8,
    marginHorizontal: 2,
  },
  dayCellSelected: { backgroundColor: "#dbeafe" },
  dayCellToday: { borderWidth: 1, borderColor: "#3b82f6" },
  dayName: { fontSize: 11, color: "#6b7280", marginBottom: 2 },
  dayNum: { fontSize: 16, fontWeight: "600", color: "#111827" },
  dayTextSelected: { color: "#2563eb" },
  dotRow: { flexDirection: "row", gap: 2, marginTop: 4 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#3b82f6" },
  jobList: { padding: 16 },
});
