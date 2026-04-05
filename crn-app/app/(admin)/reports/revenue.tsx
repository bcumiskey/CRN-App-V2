import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { useState } from "react";
import { useRevenueReport } from "../../../hooks/use-reports";
import { Card } from "../../../components/ui/Card";
import { DateRangeSelector } from "../../../components/domain/DateRangeSelector";

const groupByOptions = [
  { key: "month", label: "By Month" },
  { key: "property", label: "By Property" },
  { key: "type", label: "By Type" },
  { key: "owner", label: "By Owner" },
];

export default function RevenueReportScreen() {
  const [params, setParams] = useState<{ preset?: string; groupBy?: string }>({ preset: "this_year", groupBy: "month" });
  const revenueQuery = useRevenueReport(params);
  const data = revenueQuery.data;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Revenue Dashboard</Text>
      <DateRangeSelector onSelect={(p) => setParams({ ...params, ...p })} currentPreset={params.preset} />

      {/* Group by toggle */}
      <View style={styles.groupRow}>
        {groupByOptions.map((opt) => (
          <TouchableOpacity
            key={opt.key}
            onPress={() => setParams({ ...params, groupBy: opt.key })}
            style={[styles.groupPill, params.groupBy === opt.key && styles.groupPillActive]}
          >
            <Text style={[styles.groupText, params.groupBy === opt.key && styles.groupTextActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {!data ? (
        <Text style={styles.loading}>Loading...</Text>
      ) : data.items.length === 0 ? (
        <Text style={styles.empty}>No revenue data for this period.</Text>
      ) : (
        <Card>
          {/* Header */}
          <View style={styles.tableHeader}>
            <Text style={[styles.headerCell, { flex: 2 }]}>
              {params.groupBy === "month" ? "Month" : params.groupBy === "property" ? "Property" : params.groupBy === "type" ? "Type" : "Owner"}
            </Text>
            <Text style={[styles.headerCell, { flex: 1, textAlign: "right" }]}>Jobs</Text>
            <Text style={[styles.headerCell, { flex: 1, textAlign: "right" }]}>Revenue</Text>
            <Text style={[styles.headerCell, { flex: 1, textAlign: "right" }]}>Avg</Text>
          </View>

          {data.items.map((item, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={[styles.cell, { flex: 2 }]} numberOfLines={1}>{item.label}</Text>
              <Text style={[styles.cell, { flex: 1, textAlign: "right" }]}>{item.jobCount}</Text>
              <Text style={[styles.cellBold, { flex: 1, textAlign: "right" }]}>${item.revenue.toLocaleString()}</Text>
              <Text style={[styles.cell, { flex: 1, textAlign: "right" }]}>${item.avgPerJob.toFixed(0)}</Text>
            </View>
          ))}
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  content: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: "700", color: "#111827" },
  loading: { fontSize: 14, color: "#9ca3af", textAlign: "center", marginTop: 40 },
  empty: { fontSize: 14, color: "#9ca3af", textAlign: "center", marginTop: 40 },
  groupRow: { flexDirection: "row", gap: 6, marginBottom: 16 },
  groupPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: "#f3f4f6" },
  groupPillActive: { backgroundColor: "#dbeafe" },
  groupText: { fontSize: 13, fontWeight: "500", color: "#6b7280" },
  groupTextActive: { color: "#2563eb" },
  tableHeader: { flexDirection: "row", paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: "#e5e7eb" },
  headerCell: { fontSize: 12, fontWeight: "600", color: "#6b7280", textTransform: "uppercase" },
  tableRow: { flexDirection: "row", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  cell: { fontSize: 14, color: "#374151" },
  cellBold: { fontSize: 14, fontWeight: "600", color: "#111827" },
});
