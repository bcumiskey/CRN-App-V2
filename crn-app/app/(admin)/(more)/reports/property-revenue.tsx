import { View, Text, ScrollView, StyleSheet } from "react-native";
import { useState } from "react";
import { usePropertyRevenueReport } from "../../../../hooks/use-reports";
import { Card } from "../../../../components/ui/Card";
import { DateRangeSelector } from "../../../../components/domain/DateRangeSelector";

export default function PropertyRevenueReportScreen() {
  const [params, setParams] = useState<{ preset?: string }>({ preset: "this_month" });
  const reportQuery = usePropertyRevenueReport(params);
  const data = reportQuery.data ?? [];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Revenue by Property</Text>
      <DateRangeSelector onSelect={setParams} currentPreset={params.preset} />

      {data.length === 0 ? (
        <Text style={styles.empty}>No data for this period.</Text>
      ) : (
        data.map((item) => (
          <Card key={item.propertyId} style={styles.card}>
            <View style={styles.headerRow}>
              <Text style={styles.propName}>{item.propertyName}</Text>
              <Text style={styles.netRevenue}>${item.netToCRN.toLocaleString()}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detail}>{item.jobCount} jobs</Text>
              <Text style={styles.detail}>Avg ${item.avgPerJob.toFixed(0)}/job</Text>
              {item.houseCut > 0 && (
                <Text style={styles.detailMuted}>House cut: ${item.houseCut.toLocaleString()}</Text>
              )}
            </View>
          </Card>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  content: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: "700", color: "#111827" },
  empty: { fontSize: 14, color: "#9ca3af", textAlign: "center", marginTop: 40 },
  card: { marginBottom: 8 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  propName: { fontSize: 16, fontWeight: "600", color: "#111827" },
  netRevenue: { fontSize: 17, fontWeight: "700", color: "#16a34a" },
  detailRow: { flexDirection: "row", gap: 12 },
  detail: { fontSize: 13, color: "#6b7280" },
  detailMuted: { fontSize: 13, color: "#9ca3af" },
});
