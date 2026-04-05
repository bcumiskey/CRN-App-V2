import { View, Text, ScrollView, StyleSheet } from "react-native";
import { useState } from "react";
import { useWorkerEarningsReport } from "../../../hooks/use-reports";
import { Card } from "../../../components/ui/Card";
import { DateRangeSelector } from "../../../components/domain/DateRangeSelector";

export default function WorkerEarningsReportScreen() {
  const [params, setParams] = useState<{ preset?: string }>({ preset: "this_month" });
  const earningsQuery = useWorkerEarningsReport(params);
  const data = earningsQuery.data ?? [];

  const totalPaid = data.reduce((sum, w) => sum + w.totalPay, 0);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Worker Earnings</Text>
      <DateRangeSelector onSelect={setParams} currentPreset={params.preset} />

      {/* Summary */}
      <Card style={styles.summary}>
        <Text style={styles.summaryValue}>${totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
        <Text style={styles.summaryLabel}>Total Team Payroll</Text>
      </Card>

      {/* Per-worker breakdown */}
      {data.length === 0 ? (
        <Text style={styles.empty}>No earnings data for this period.</Text>
      ) : (
        data.map((worker) => (
          <Card key={worker.userId} style={styles.workerCard}>
            <View style={styles.workerHeader}>
              <Text style={styles.workerName}>{worker.userName}</Text>
              <Text style={styles.workerTotal}>${worker.totalPay.toFixed(2)}</Text>
            </View>
            <View style={styles.detailRow}>
              <Detail label="Jobs" value={String(worker.jobsWorked)} />
              <Detail label="Shares" value={worker.totalShares.toFixed(1)} />
              <Detail label="Pool" value={`$${worker.workerPoolPay.toFixed(2)}`} />
              {worker.ownerPay > 0 && <Detail label="Owner" value={`$${worker.ownerPay.toFixed(2)}`} />}
              <Detail label="Avg/Job" value={`$${worker.avgPerJob.toFixed(2)}`} />
            </View>
            {worker.requires1099 && (
              <View style={styles.flag1099}>
                <Text style={styles.flag1099Text}>1099 Required</Text>
              </View>
            )}
          </Card>
        ))
      )}
    </ScrollView>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detail}>
      <Text style={styles.detailValue}>{value}</Text>
      <Text style={styles.detailLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  content: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: "700", color: "#111827" },
  empty: { fontSize: 14, color: "#9ca3af", textAlign: "center", marginTop: 40 },
  summary: { alignItems: "center", marginBottom: 16, paddingVertical: 16 },
  summaryValue: { fontSize: 28, fontWeight: "700", color: "#111827" },
  summaryLabel: { fontSize: 13, color: "#6b7280", marginTop: 4 },
  workerCard: { marginBottom: 8 },
  workerHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  workerName: { fontSize: 16, fontWeight: "600", color: "#111827" },
  workerTotal: { fontSize: 18, fontWeight: "700", color: "#16a34a" },
  detailRow: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  detail: {},
  detailValue: { fontSize: 14, fontWeight: "500", color: "#111827" },
  detailLabel: { fontSize: 11, color: "#9ca3af" },
  flag1099: { marginTop: 8, backgroundColor: "#fef2f2", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, alignSelf: "flex-start" },
  flag1099Text: { fontSize: 12, fontWeight: "600", color: "#dc2626" },
});
