import { View, Text, FlatList, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useState, useMemo } from "react";
import { useWorkerSchedule } from "../../hooks/use-worker";
import { Card } from "../../components/ui/Card";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { EmptyState } from "../../components/ui/EmptyState";

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}
function addDays(date: Date, days: number): Date {
  const r = new Date(date); r.setDate(r.getDate() + days); return r;
}

export default function WorkerScheduleScreen() {
  const router = useRouter();
  const [weekStart, setWeekStart] = useState(() => {
    const now = new Date();
    return addDays(now, -now.getDay());
  });
  const [selectedDate, setSelectedDate] = useState(() => formatDate(new Date()));

  const startDate = formatDate(weekStart);
  const endDate = formatDate(addDays(weekStart, 6));
  const scheduleQuery = useWorkerSchedule({ startDate, endDate });
  const jobs = scheduleQuery.data?.jobs ?? [];

  const jobsByDate = useMemo(() => {
    const map: Record<string, typeof jobs> = {};
    for (const j of jobs) {
      if (!map[j.scheduledDate]) map[j.scheduledDate] = [];
      map[j.scheduledDate].push(j);
    }
    return map;
  }, [jobs]);

  const weekDays = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => {
      const d = addDays(weekStart, i);
      const ds = formatDate(d);
      return {
        date: ds,
        dayName: d.toLocaleDateString("en-US", { weekday: "short" }),
        dayNum: d.getDate(),
        isToday: ds === formatDate(new Date()),
        jobCount: (jobsByDate[ds] ?? []).length,
      };
    }), [weekStart, jobsByDate]);

  const selectedJobs = jobsByDate[selectedDate] ?? [];

  return (
    <View style={styles.container}>
      {/* Week nav */}
      <View style={styles.weekNav}>
        <Text style={styles.navArrow} onPress={() => setWeekStart(addDays(weekStart, -7))}>←</Text>
        <Text style={styles.weekLabel}>
          {weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} — {addDays(weekStart, 6).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </Text>
        <Text style={styles.navArrow} onPress={() => setWeekStart(addDays(weekStart, 7))}>→</Text>
      </View>

      {/* Week strip */}
      <View style={styles.weekStrip}>
        {weekDays.map((day) => (
          <TouchableOpacity
            key={day.date}
            style={[styles.dayCell, day.date === selectedDate && styles.dayCellSelected, day.isToday && styles.dayCellToday]}
            onPress={() => setSelectedDate(day.date)}
          >
            <Text style={[styles.dayName, day.date === selectedDate && styles.dayTextSel]}>{day.dayName}</Text>
            <Text style={[styles.dayNum, day.date === selectedDate && styles.dayTextSel]}>{day.dayNum}</Text>
            {day.jobCount > 0 && <View style={styles.dot} />}
          </TouchableOpacity>
        ))}
      </View>

      {/* Jobs */}
      <FlatList
        data={selectedJobs}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => router.push(`/(worker)/jobs/${item.id}`)}>
            <Card style={styles.jobCard}>
              <View style={styles.jobRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.propName}>{item.property.name}</Text>
                  <Text style={styles.jobInfo}>{item.jobType}{item.scheduledTime ? ` • ${item.scheduledTime}` : ""}</Text>
                </View>
                <StatusBadge status={item.status} />
              </View>
              {/* NO financial data */}
            </Card>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<EmptyState title="No jobs" message="Nothing scheduled for this day." />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  weekNav: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#fff" },
  navArrow: { fontSize: 20, color: "#2563eb", padding: 8 },
  weekLabel: { fontSize: 15, fontWeight: "600", color: "#111827" },
  weekStrip: { flexDirection: "row", backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e5e7eb", paddingBottom: 12 },
  dayCell: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 8, marginHorizontal: 2 },
  dayCellSelected: { backgroundColor: "#dbeafe" },
  dayCellToday: { borderWidth: 1, borderColor: "#3b82f6" },
  dayName: { fontSize: 11, color: "#6b7280", marginBottom: 2 },
  dayNum: { fontSize: 16, fontWeight: "600", color: "#111827" },
  dayTextSel: { color: "#2563eb" },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#3b82f6", marginTop: 4 },
  list: { padding: 16 },
  jobCard: { marginBottom: 8 },
  jobRow: { flexDirection: "row", alignItems: "center" },
  propName: { fontSize: 16, fontWeight: "600", color: "#111827" },
  jobInfo: { fontSize: 13, color: "#6b7280", marginTop: 2 },
});
