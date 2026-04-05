import { View, Text, ScrollView, StyleSheet } from "react-native";
import { use1099SummaryReport } from "../../../hooks/use-reports";
import { Card } from "../../../components/ui/Card";

export default function Tax1099ReportScreen() {
  const reportQuery = use1099SummaryReport();
  const data = reportQuery.data ?? [];

  const requiring1099 = data.filter((w) => w.requires1099);
  const missingW9 = data.filter((w) => w.requires1099 && !w.w9OnFile);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>1099 Summary</Text>
      <Text style={styles.subtitle}>Tax Year {new Date().getFullYear()}</Text>

      {/* Summary */}
      <View style={styles.statsRow}>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{requiring1099.length}</Text>
          <Text style={styles.statLabel}>1099s Required</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={[styles.statValue, missingW9.length > 0 && styles.redText]}>{missingW9.length}</Text>
          <Text style={styles.statLabel}>Missing W-9</Text>
        </Card>
      </View>

      {/* Worker list */}
      {data.map((worker) => (
        <Card key={worker.userId} style={styles.workerCard}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.workerName}>{worker.userName}</Text>
              <Text style={styles.amount}>${worker.totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
            </View>
            <View style={styles.badges}>
              {worker.requires1099 ? (
                <View style={styles.badge1099}><Text style={styles.badge1099Text}>1099 Required</Text></View>
              ) : (
                <View style={styles.badgeUnder}><Text style={styles.badgeUnderText}>Under Threshold</Text></View>
              )}
              {worker.requires1099 && (
                worker.w9OnFile ? (
                  <View style={styles.badgeW9}><Text style={styles.badgeW9Text}>W-9 ✓</Text></View>
                ) : (
                  <View style={styles.badgeMissing}><Text style={styles.badgeMissingText}>Missing W-9</Text></View>
                )
              )}
            </View>
          </View>
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  content: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: "700", color: "#111827" },
  subtitle: { fontSize: 14, color: "#6b7280", marginBottom: 16 },
  statsRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  statCard: { flex: 1, alignItems: "center", paddingVertical: 12 },
  statValue: { fontSize: 24, fontWeight: "700", color: "#111827" },
  redText: { color: "#dc2626" },
  statLabel: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  workerCard: { marginBottom: 8 },
  row: { flexDirection: "row", alignItems: "center" },
  workerName: { fontSize: 16, fontWeight: "600", color: "#111827" },
  amount: { fontSize: 14, color: "#6b7280", marginTop: 2 },
  badges: { gap: 4, alignItems: "flex-end" },
  badge1099: { backgroundColor: "#fef2f2", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  badge1099Text: { fontSize: 11, fontWeight: "600", color: "#dc2626" },
  badgeUnder: { backgroundColor: "#f3f4f6", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  badgeUnderText: { fontSize: 11, fontWeight: "500", color: "#9ca3af" },
  badgeW9: { backgroundColor: "#f0fdf4", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  badgeW9Text: { fontSize: 11, fontWeight: "600", color: "#16a34a" },
  badgeMissing: { backgroundColor: "#fef2f2", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  badgeMissingText: { fontSize: 11, fontWeight: "600", color: "#dc2626" },
});
