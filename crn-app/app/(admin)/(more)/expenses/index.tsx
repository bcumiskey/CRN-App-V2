import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { useState, useMemo } from "react";
import { useExpenses, useExpenseSummary } from "../../../../hooks/use-expenses";
import { Card } from "../../../../components/ui/Card";
import { EmptyState } from "../../../../components/ui/EmptyState";

function fmt(n: number) {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getMonthRange(offset = 0) {
  const d = new Date();
  d.setMonth(d.getMonth() + offset);
  const year = d.getFullYear();
  const month = d.getMonth();
  const start = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const end = new Date(year, month + 1, 0);
  const endStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;
  return { startDate: start, endDate: endStr };
}

const PERIOD_OPTIONS = ["This Month", "Last Month", "All"] as const;
type Period = (typeof PERIOD_OPTIONS)[number];

export default function ExpensesScreen() {
  const router = useRouter();
  const [period, setPeriod] = useState<Period>("This Month");

  const dateRange = useMemo(() => {
    if (period === "This Month") return getMonthRange(0);
    if (period === "Last Month") return getMonthRange(-1);
    return {};
  }, [period]);

  const expensesQuery = useExpenses(dateRange);
  const expenses = expensesQuery.data ?? [];

  const summaryQuery = useExpenseSummary(dateRange);
  const summary = summaryQuery.data;

  const topCategories = useMemo(() => {
    if (!summary?.breakdown) return [];
    return [...summary.breakdown]
      .sort((a, b) => b.total - a.total)
      .slice(0, 3);
  }, [summary]);

  return (
    <View style={styles.container}>
      {/* Period Selector */}
      <View style={styles.tabRow}>
        {PERIOD_OPTIONS.map((p) => (
          <TouchableOpacity
            key={p}
            onPress={() => setPeriod(p)}
            style={[styles.tab, period === p && styles.tabActive]}
          >
            <Text style={[styles.tabText, period === p && styles.tabTextActive]}>{p}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={expenses}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={expensesQuery.isRefetching}
            onRefresh={() => {
              expensesQuery.refetch();
              summaryQuery.refetch();
            }}
          />
        }
        ListHeaderComponent={
          <>
            {/* Summary Card */}
            {summary && (
              <Card style={styles.summaryCard}>
                <View style={styles.summaryTop}>
                  <View>
                    <Text style={styles.summaryLabel}>Total Expenses</Text>
                    <Text style={styles.summaryValue}>{fmt(summary.total)}</Text>
                  </View>
                  <View>
                    <Text style={styles.summaryLabel}>Deductible</Text>
                    <Text style={[styles.summaryValue, { color: "#16a34a" }]}>
                      {fmt(summary.totalDeductible)}
                    </Text>
                  </View>
                </View>
                {topCategories.length > 0 && (
                  <View style={styles.categoriesSection}>
                    <Text style={styles.categoriesTitle}>Top Categories</Text>
                    {topCategories.map((cat, i) => (
                      <View key={i} style={styles.categoryRow}>
                        <Text style={styles.categoryName}>{cat.categoryName}</Text>
                        <Text style={styles.categoryTotal}>{fmt(cat.total)}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </Card>
            )}
          </>
        }
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => router.push(`/(admin)/expenses/add?id=${item.id}`)}>
            <Card style={styles.expenseCard}>
              <View style={styles.cardTop}>
                <View style={styles.cardTopLeft}>
                  <Text style={styles.expenseDate}>{item.date}</Text>
                  <Text style={styles.expenseVendor} numberOfLines={1}>
                    {item.vendor || "No vendor"}
                  </Text>
                </View>
                <Text style={styles.expenseAmount}>{fmt(item.amount)}</Text>
              </View>
              <View style={styles.cardBottom}>
                <View style={styles.cardBottomLeft}>
                  <Text style={styles.categoryBadge}>
                    {item.category?.name ?? "Uncategorized"}
                  </Text>
                  {item.receiptUrl && <Text style={styles.receiptIcon}>&#128206;</Text>}
                </View>
                {item.isDeductible && <Text style={styles.deductibleCheck}>&#10003; Deductible</Text>}
              </View>
              {item.description ? (
                <Text style={styles.expenseDesc} numberOfLines={1}>
                  {item.description}
                </Text>
              ) : null}
            </Card>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          expensesQuery.isLoading ? null : (
            <EmptyState
              title="No expenses"
              message="Track your business expenses here."
              actionLabel="Add Expense"
              onAction={() => router.push("/(admin)/expenses/add")}
            />
          )
        }
      />

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push("/(admin)/expenses/add")}
        activeOpacity={0.8}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  tabRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#f3f4f6",
  },
  tabActive: { backgroundColor: "#dbeafe" },
  tabText: { fontSize: 13, fontWeight: "500", color: "#6b7280" },
  tabTextActive: { color: "#2563eb" },
  list: { padding: 16 },
  summaryCard: { marginBottom: 16 },
  summaryTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  summaryLabel: { fontSize: 12, color: "#6b7280", marginBottom: 4 },
  summaryValue: { fontSize: 22, fontWeight: "700", color: "#111827" },
  categoriesSection: {
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
    paddingTop: 10,
  },
  categoriesTitle: { fontSize: 12, fontWeight: "600", color: "#9ca3af", marginBottom: 6 },
  categoryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
  },
  categoryName: { fontSize: 13, color: "#374151" },
  categoryTotal: { fontSize: 13, fontWeight: "600", color: "#111827" },
  expenseCard: { marginBottom: 8 },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 6,
  },
  cardTopLeft: { flex: 1, marginRight: 12 },
  expenseDate: { fontSize: 12, color: "#9ca3af" },
  expenseVendor: { fontSize: 15, fontWeight: "600", color: "#111827", marginTop: 2 },
  expenseAmount: { fontSize: 17, fontWeight: "700", color: "#111827" },
  cardBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardBottomLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  categoryBadge: {
    fontSize: 11,
    fontWeight: "500",
    color: "#6b7280",
    backgroundColor: "#f3f4f6",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    overflow: "hidden",
  },
  receiptIcon: { fontSize: 14 },
  deductibleCheck: { fontSize: 11, color: "#16a34a", fontWeight: "500" },
  expenseDesc: { fontSize: 12, color: "#9ca3af", marginTop: 4 },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
  fabText: { fontSize: 28, color: "#ffffff", fontWeight: "300", marginTop: -2 },
});
