import { View, Text, ScrollView, StyleSheet } from "react-native";
import { useState } from "react";
import { usePnlReport } from "../../../hooks/use-reports";
import { Card } from "../../../components/ui/Card";
import { DateRangeSelector } from "../../../components/domain/DateRangeSelector";

export default function PnlReportScreen() {
  const [params, setParams] = useState<{ preset?: string }>({ preset: "this_month" });
  const pnlQuery = usePnlReport(params);
  const data = pnlQuery.data;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Profit & Loss</Text>
      <DateRangeSelector onSelect={setParams} currentPreset={params.preset} />

      {!data ? (
        <Text style={styles.loading}>Loading...</Text>
      ) : (
        <>
          {/* Summary Cards */}
          <View style={styles.statsRow}>
            <StatCard label="Net Revenue" value={data.netRevenue} color="#16a34a" />
            <StatCard label="Expenses" value={data.totalExpenses} color="#dc2626" />
            <StatCard label="Net Profit" value={data.netProfit} color={data.netProfit >= 0 ? "#16a34a" : "#dc2626"} />
          </View>

          {/* Revenue Section */}
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Revenue</Text>
            <PnlRow label="Gross job revenue" value={data.grossRevenue} />
            <PnlRow label="Less: house cuts" value={-data.houseCuts} muted />
            <PnlRow label="Net service revenue" value={data.netRevenue} bold />
          </Card>

          {/* Cost of Labor */}
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Cost of Labor</Text>
            <PnlRow label="Worker pool payouts" value={data.workerPool} />
            <PnlRow label="Owner profit distributions" value={data.ownerProfit} />
            <PnlRow label="Business expense allocation" value={data.businessExpense} />
          </Card>

          {/* Operating Expenses */}
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Operating Expenses</Text>
            {data.operatingExpenses.map((exp, i) => (
              <PnlRow key={i} label={exp.category} value={exp.amount} />
            ))}
            <View style={styles.divider} />
            <PnlRow label="Total Operating Expenses" value={data.totalExpenses} bold />
          </Card>

          {/* Bottom Line */}
          <Card style={[styles.section, styles.profitCard]}>
            <PnlRow
              label="NET PROFIT"
              value={data.netProfit}
              bold
              large
            />
          </Card>
        </>
      )}
    </ScrollView>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <Card style={styles.statCard}>
      <Text style={[styles.statValue, { color }]}>${Math.abs(value).toLocaleString()}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Card>
  );
}

function PnlRow({ label, value, bold, muted, large }: {
  label: string; value: number; bold?: boolean; muted?: boolean; large?: boolean;
}) {
  const isNeg = value < 0;
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, muted && styles.muted, large && styles.large]}>{label}</Text>
      <Text style={[
        styles.rowValue,
        bold && styles.bold,
        muted && styles.muted,
        large && styles.large,
        isNeg && styles.negative,
      ]}>
        {isNeg ? "-" : ""}${Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  content: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: "700", color: "#111827" },
  loading: { fontSize: 14, color: "#9ca3af", textAlign: "center", marginTop: 40 },
  statsRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  statCard: { flex: 1, alignItems: "center", paddingVertical: 12 },
  statValue: { fontSize: 18, fontWeight: "700" },
  statLabel: { fontSize: 11, color: "#6b7280", marginTop: 2 },
  section: { marginBottom: 12 },
  sectionTitle: { fontSize: 13, fontWeight: "600", color: "#6b7280", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  rowLabel: { fontSize: 14, color: "#374151" },
  rowValue: { fontSize: 14, color: "#111827" },
  bold: { fontWeight: "600" },
  muted: { color: "#9ca3af" },
  large: { fontSize: 16 },
  negative: { color: "#dc2626" },
  divider: { height: 1, backgroundColor: "#e5e7eb", marginVertical: 8 },
  profitCard: { backgroundColor: "#f0fdf4" },
});
