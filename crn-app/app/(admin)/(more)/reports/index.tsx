import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Card } from "../../../../components/ui/Card";

interface ReportItem {
  key: string;
  label: string;
  route: string;
}

interface ReportCategory {
  title: string;
  emoji: string;
  reports: ReportItem[];
}

const categories: ReportCategory[] = [
  {
    title: "Financial",
    emoji: "💰",
    reports: [
      { key: "pnl", label: "P&L Summary", route: "/(admin)/reports/pnl" },
      { key: "revenue", label: "Revenue Dashboard", route: "/(admin)/reports/revenue" },
      { key: "cash-flow", label: "Cash Flow", route: "/(admin)/reports/cash-flow" },
      { key: "ar-aging", label: "AR Aging", route: "/(admin)/reports/ar-aging" },
    ],
  },
  {
    title: "Property",
    emoji: "🏠",
    reports: [
      { key: "property-revenue", label: "Revenue by Property", route: "/(admin)/reports/property-revenue" },
      { key: "property-profitability", label: "Profitability", route: "/(admin)/reports/property-profitability" },
      { key: "job-frequency", label: "Job Frequency", route: "/(admin)/reports/job-frequency" },
    ],
  },
  {
    title: "Team",
    emoji: "👥",
    reports: [
      { key: "worker-earnings", label: "Worker Earnings", route: "/(admin)/reports/worker-earnings" },
      { key: "labor-cost", label: "Labor Cost Analysis", route: "/(admin)/reports/labor-cost" },
    ],
  },
  {
    title: "Operational",
    emoji: "📊",
    reports: [
      { key: "completion-rate", label: "Completion Rate", route: "/(admin)/reports/completion-rate" },
      { key: "job-volume", label: "Job Volume", route: "/(admin)/reports/job-volume" },
      { key: "job-type-mix", label: "Job Type Mix", route: "/(admin)/reports/job-type-mix" },
    ],
  },
  {
    title: "Tax",
    emoji: "🧾",
    reports: [
      { key: "1099-summary", label: "1099 Summary", route: "/(admin)/reports/tax-1099" },
      { key: "schedule-c", label: "Schedule C", route: "/(admin)/reports/schedule-c" },
      { key: "mileage-summary", label: "Mileage Summary", route: "/(admin)/reports/mileage-summary" },
    ],
  },
];

export default function ReportsScreen() {
  const router = useRouter();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Reports</Text>

      {categories.map((cat) => (
        <Card key={cat.title} style={styles.category}>
          <Text style={styles.categoryTitle}>{cat.emoji} {cat.title}</Text>
          {cat.reports.map((report) => (
            <TouchableOpacity
              key={report.key}
              style={styles.reportItem}
              onPress={() => router.push(report.route as any)}
              activeOpacity={0.7}
            >
              <Text style={styles.reportLabel}>{report.label}</Text>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          ))}
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  content: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: "700", color: "#111827", marginBottom: 16 },
  category: { marginBottom: 12 },
  categoryTitle: { fontSize: 16, fontWeight: "600", color: "#111827", marginBottom: 8 },
  reportItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
  },
  reportLabel: { fontSize: 15, color: "#374151" },
  chevron: { fontSize: 20, color: "#d1d5db" },
});
