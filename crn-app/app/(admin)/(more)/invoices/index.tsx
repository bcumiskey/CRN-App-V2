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
import { useInvoices } from "../../../../hooks/use-invoices";
import { Card } from "../../../../components/ui/Card";
import { StatusBadge } from "../../../../components/ui/StatusBadge";
import { EmptyState } from "../../../../components/ui/EmptyState";
import { Button } from "../../../../components/ui/Button";

const TABS = ["all", "draft", "sent", "paid", "overdue", "void"] as const;
type Tab = (typeof TABS)[number];

function fmt(n: number) {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function InvoicesScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("all");

  const filters = activeTab === "all" ? {} : { status: activeTab };
  const invoicesQuery = useInvoices(filters);
  const invoices = invoicesQuery.data?.invoices ?? [];

  // Also fetch all for stats
  const allQuery = useInvoices({});
  const allInvoices = allQuery.data?.invoices ?? [];

  const stats = useMemo(() => {
    const now = new Date();
    let totalInvoiced = 0;
    let outstanding = 0;
    let overdue = 0;
    let collectedThisMonth = 0;

    for (const inv of allInvoices) {
      totalInvoiced += inv.total;
      if (inv.status === "sent" || inv.status === "overdue") {
        outstanding += inv.total;
      }
      if (inv.status === "overdue") {
        overdue += inv.total;
      }
      if (
        inv.status === "paid" &&
        inv.createdAt &&
        new Date(inv.createdAt).getMonth() === now.getMonth() &&
        new Date(inv.createdAt).getFullYear() === now.getFullYear()
      ) {
        collectedThisMonth += inv.total;
      }
    }
    return { totalInvoiced, outstanding, overdue, collectedThisMonth };
  }, [allInvoices]);

  return (
    <View style={styles.container}>
      {/* Filter tabs */}
      <View style={styles.tabRow}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab}
            onPress={() => setActiveTab(tab)}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={invoices}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={invoicesQuery.isRefetching}
            onRefresh={() => {
              invoicesQuery.refetch();
              allQuery.refetch();
            }}
          />
        }
        ListHeaderComponent={
          <>
            {/* Stats cards */}
            <View style={styles.statsRow}>
              <Card style={styles.statCard}>
                <Text style={styles.statLabel}>Total Invoiced</Text>
                <Text style={styles.statValue}>{fmt(stats.totalInvoiced)}</Text>
              </Card>
              <Card style={styles.statCard}>
                <Text style={styles.statLabel}>Outstanding</Text>
                <Text style={[styles.statValue, { color: "#2563eb" }]}>{fmt(stats.outstanding)}</Text>
              </Card>
            </View>
            <View style={styles.statsRow}>
              <Card style={styles.statCard}>
                <Text style={styles.statLabel}>Overdue</Text>
                <Text style={[styles.statValue, { color: "#ea580c" }]}>{fmt(stats.overdue)}</Text>
              </Card>
              <Card style={styles.statCard}>
                <Text style={styles.statLabel}>Collected This Month</Text>
                <Text style={[styles.statValue, { color: "#16a34a" }]}>{fmt(stats.collectedThisMonth)}</Text>
              </Card>
            </View>

            {/* Actions */}
            <View style={styles.actionRow}>
              <Button
                onPress={() => router.push("/(admin)/invoices/generate-monthly")}
                variant="outline"
                size="sm"
              >
                Generate Monthly
              </Button>
            </View>
          </>
        }
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => router.push(`/(admin)/invoices/${item.id}`)}>
            <Card style={styles.invoiceCard}>
              <View style={styles.cardTop}>
                <View style={styles.cardTopLeft}>
                  <Text style={styles.invoiceNumber}>{item.invoiceNumber}</Text>
                  <Text style={styles.invoiceDate}>{item.invoiceDate}</Text>
                </View>
                <Text style={styles.invoiceTotal}>{fmt(item.total)}</Text>
              </View>
              <View style={styles.cardMiddle}>
                <Text style={styles.ownerName} numberOfLines={1}>
                  {item.owner?.name ?? "Unknown"}
                  {item.property ? ` - ${item.property.name}` : ""}
                </Text>
              </View>
              <View style={styles.cardBottom}>
                <StatusBadge status={item.type} size="sm" />
                <StatusBadge status={item.status} size="sm" />
              </View>
            </Card>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          invoicesQuery.isLoading ? null : (
            <EmptyState
              title="No invoices"
              message={
                activeTab === "all"
                  ? "Create your first invoice to get started."
                  : `No ${activeTab} invoices found.`
              }
            />
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  tabRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 6,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    flexWrap: "wrap",
  },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#f3f4f6",
  },
  tabActive: { backgroundColor: "#dbeafe" },
  tabText: { fontSize: 12, fontWeight: "500", color: "#6b7280" },
  tabTextActive: { color: "#2563eb" },
  list: { padding: 16 },
  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    padding: 14,
  },
  statLabel: { fontSize: 12, color: "#6b7280", marginBottom: 4 },
  statValue: { fontSize: 20, fontWeight: "700", color: "#111827" },
  actionRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 16,
  },
  invoiceCard: { marginBottom: 8 },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 6,
  },
  cardTopLeft: {},
  invoiceNumber: { fontSize: 15, fontWeight: "600", color: "#111827" },
  invoiceDate: { fontSize: 12, color: "#9ca3af", marginTop: 2 },
  invoiceTotal: { fontSize: 17, fontWeight: "700", color: "#111827" },
  cardMiddle: { marginBottom: 8 },
  ownerName: { fontSize: 13, color: "#6b7280" },
  cardBottom: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
});
