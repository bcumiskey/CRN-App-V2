import { View, Text, ScrollView, StyleSheet } from "react-native";
import { useState } from "react";
import { useScheduleCReport } from "../../../../hooks/use-reports";
import { Card } from "../../../../components/ui/Card";
import { DateRangeSelector } from "../../../../components/domain/DateRangeSelector";

export default function ScheduleCReportScreen() {
  const [params, setParams] = useState<{ preset?: string }>({ preset: "this_year" });
  const reportQuery = useScheduleCReport(params);
  const data = reportQuery.data ?? [];

  const totalDeductions = data.reduce((sum, item) => sum + item.amount, 0);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Schedule C Mapping</Text>
      <DateRangeSelector onSelect={setParams} currentPreset={params.preset} />

      <Card style={styles.totalCard}>
        <Text style={styles.totalLabel}>Total Deductions</Text>
        <Text style={styles.totalValue}>${totalDeductions.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
      </Card>

      {data.length === 0 ? (
        <Text style={styles.empty}>No expense data for this period.</Text>
      ) : (
        <Card>
          <View style={styles.tableHeader}>
            <Text style={[styles.headerCell, { flex: 2 }]}>Schedule C Line</Text>
            <Text style={[styles.headerCell, { flex: 2 }]}>Category</Text>
            <Text style={[styles.headerCell, { flex: 1, textAlign: "right" }]}>Amount</Text>
          </View>
          {data.map((item, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={[styles.cell, { flex: 2 }]} numberOfLines={1}>{item.line}</Text>
              <Text style={[styles.cell, { flex: 2 }]}>{item.category}</Text>
              <Text style={[styles.cellBold, { flex: 1, textAlign: "right" }]}>${item.amount.toFixed(2)}</Text>
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
  empty: { fontSize: 14, color: "#9ca3af", textAlign: "center", marginTop: 40 },
  totalCard: { alignItems: "center", paddingVertical: 16, marginBottom: 16 },
  totalLabel: { fontSize: 13, color: "#6b7280" },
  totalValue: { fontSize: 28, fontWeight: "700", color: "#111827", marginTop: 4 },
  tableHeader: { flexDirection: "row", paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: "#e5e7eb" },
  headerCell: { fontSize: 12, fontWeight: "600", color: "#6b7280", textTransform: "uppercase" },
  tableRow: { flexDirection: "row", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  cell: { fontSize: 14, color: "#374151" },
  cellBold: { fontSize: 14, fontWeight: "600", color: "#111827" },
});
