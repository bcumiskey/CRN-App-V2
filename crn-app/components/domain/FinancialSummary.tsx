import { View, Text, StyleSheet } from "react-native";
import { calculateJob } from "crn-shared";
import type { FinancialModel, JobInput } from "crn-shared";
import { Card } from "../ui/Card";

interface FinancialSummaryProps {
  financialModel: FinancialModel;
  totalFee: number;
  houseCutPercent: number;
  charges: Array<{ amount: number; reason: string }>;
  assignments: Array<{
    userId: string;
    userName: string;
    share: number;
    isOwner: boolean;
  }>;
}

/**
 * Live financial breakdown computed from calculateJob().
 * Admin-only component — never shown to workers.
 */
export function FinancialSummary({
  financialModel,
  totalFee,
  houseCutPercent,
  charges,
  assignments,
}: FinancialSummaryProps) {
  const input: JobInput = {
    totalFee,
    houseCutPercent,
    charges: charges.map((c) => ({ amount: c.amount })),
    assignments,
  };

  const result = calculateJob(financialModel, input);

  return (
    <Card>
      <Text style={styles.title}>Financial Summary</Text>

      {/* Revenue section */}
      <Row label="Base Fee" value={totalFee} />
      {charges.map((c, i) => (
        <Row key={i} label={c.reason} value={c.amount} indent />
      ))}
      {charges.length > 0 && (
        <Row label="Gross Revenue" value={result.grossRevenue} bold />
      )}
      <Row label={`House Cut (${houseCutPercent}%)`} value={-result.houseCutAmount} muted />
      <Divider />
      <Row label="Net to CRN" value={result.netRevenue} bold />

      {/* Bucket breakdown */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Bucket Breakdown</Text>
        {result.buckets.map((b, i) => (
          <Row key={i} label={`${b.name} (${b.percent}%)`} value={b.amount} />
        ))}
      </View>

      {/* Worker payments */}
      {result.workerPayments.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Crew Pay</Text>
          {result.workerPayments.map((w) => (
            <View key={w.userId} style={styles.workerRow}>
              <View style={styles.workerInfo}>
                <Text style={styles.workerName}>{w.userName}</Text>
                <Text style={styles.workerShare}>
                  {w.share === 1 ? "Full" : w.share === 0.75 ? "3/4" : w.share === 0.5 ? "Half" : w.share === 0 ? "Off" : `${w.share}`}
                  {w.ownerPay > 0 ? " + Owner" : ""}
                </Text>
              </View>
              <Text style={styles.workerPay}>${w.totalPay.toFixed(2)}</Text>
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}

function Row({
  label,
  value,
  bold = false,
  muted = false,
  indent = false,
}: {
  label: string;
  value: number;
  bold?: boolean;
  muted?: boolean;
  indent?: boolean;
}) {
  const isNegative = value < 0;
  return (
    <View style={[styles.row, indent && styles.indent]}>
      <Text style={[styles.rowLabel, muted && styles.muted]}>
        {label}
      </Text>
      <Text
        style={[
          styles.rowValue,
          bold && styles.bold,
          muted && styles.muted,
          isNegative && styles.negative,
        ]}
      >
        {isNegative ? "-" : ""}${Math.abs(value).toFixed(2)}
      </Text>
    </View>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  title: { fontSize: 16, fontWeight: "600", color: "#111827", marginBottom: 12 },
  section: { marginTop: 16 },
  sectionTitle: { fontSize: 13, fontWeight: "600", color: "#6b7280", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  indent: { paddingLeft: 16 },
  rowLabel: { fontSize: 14, color: "#374151" },
  rowValue: { fontSize: 14, color: "#111827" },
  bold: { fontWeight: "600" },
  muted: { color: "#9ca3af" },
  negative: { color: "#dc2626" },
  divider: { height: 1, backgroundColor: "#e5e7eb", marginVertical: 8 },
  workerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 6 },
  workerInfo: { flex: 1 },
  workerName: { fontSize: 14, fontWeight: "500", color: "#111827" },
  workerShare: { fontSize: 12, color: "#9ca3af" },
  workerPay: { fontSize: 15, fontWeight: "600", color: "#111827" },
});
