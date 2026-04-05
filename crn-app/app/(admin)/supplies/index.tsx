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
import { useSupplies } from "../../../hooks/use-supplies";
import { Card } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";

function fmt(n: number) {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const CATEGORIES = ["All", "Cleaning", "Paper", "Laundry", "Equipment", "Other"] as const;
type Category = (typeof CATEGORIES)[number];

const STATUS_OPTIONS = ["All", "Reorder", "OK"] as const;
type StatusOption = (typeof STATUS_OPTIONS)[number];

export default function SuppliesScreen() {
  const router = useRouter();
  const [category, setCategory] = useState<Category>("All");
  const [statusFilter, setStatusFilter] = useState<StatusOption>("All");

  const suppliesQuery = useSupplies(
    category !== "All" ? { category: category.toLowerCase() } : undefined
  );
  const supplies = suppliesQuery.data ?? [];

  const filtered = useMemo(() => {
    if (statusFilter === "All") return supplies;
    if (statusFilter === "Reorder") return supplies.filter((s) => s.onHand <= s.reorderLevel);
    return supplies.filter((s) => s.onHand > s.reorderLevel);
  }, [supplies, statusFilter]);

  return (
    <View style={styles.container}>
      {/* Category Filters */}
      <View style={styles.filterSection}>
        <View style={styles.filterRow}>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat}
              onPress={() => setCategory(cat)}
              style={[styles.filterPill, category === cat && styles.filterPillActive]}
            >
              <Text style={[styles.filterText, category === cat && styles.filterTextActive]}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {/* Status Filters */}
        <View style={styles.filterRow}>
          {STATUS_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt}
              onPress={() => setStatusFilter(opt)}
              style={[styles.filterPill, statusFilter === opt && styles.filterPillActive]}
            >
              <Text style={[styles.filterText, statusFilter === opt && styles.filterTextActive]}>
                {opt}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={suppliesQuery.isRefetching}
            onRefresh={() => suppliesQuery.refetch()}
          />
        }
        renderItem={({ item }) => {
          const needsReorder = item.onHand <= item.reorderLevel;
          return (
            <TouchableOpacity onPress={() => router.push(`/(admin)/supplies/${item.id}`)}>
              <Card
                style={[
                  styles.supplyCard,
                  {
                    borderLeftWidth: 4,
                    borderLeftColor: needsReorder ? "#fde68a" : "#bbf7d0",
                  },
                ]}
              >
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.supplyName}>{item.name}</Text>
                    <View style={styles.categoryChipRow}>
                      <View style={styles.categoryChip}>
                        <Text style={styles.categoryChipText}>{item.category}</Text>
                      </View>
                    </View>
                  </View>
                  <View
                    style={[
                      styles.statusChip,
                      {
                        backgroundColor: needsReorder ? "#fef3c7" : "#dcfce7",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusChipText,
                        { color: needsReorder ? "#d97706" : "#16a34a" },
                      ]}
                    >
                      {needsReorder ? "\u26A0 Reorder" : "\u2713 OK"}
                    </Text>
                  </View>
                </View>
                <View style={styles.cardMeta}>
                  <Text style={styles.metaText}>On Hand: {item.onHand}</Text>
                  <Text style={styles.metaSep}>{"|"}</Text>
                  <Text style={styles.metaText}>Reorder at: {item.reorderLevel}</Text>
                </View>
                <View style={styles.cardFooter}>
                  <Text style={styles.footerText}>
                    {fmt(item.unitCost)} / {item.unit}
                  </Text>
                  {item.vendor ? (
                    <Text style={styles.footerVendor}>{item.vendor}</Text>
                  ) : null}
                </View>
              </Card>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          suppliesQuery.isLoading ? null : (
            <EmptyState
              title="No supplies"
              message="Track your cleaning supplies here."
              actionLabel="Add Supply"
              onAction={() => router.push("/(admin)/supplies/new" as any)}
            />
          )
        }
      />

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push("/(admin)/supplies/new" as any)}
        activeOpacity={0.8}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  filterSection: {
    backgroundColor: "#ffffff",
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    gap: 8,
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#f3f4f6",
  },
  filterPillActive: { backgroundColor: "#dbeafe" },
  filterText: { fontSize: 12, fontWeight: "500", color: "#6b7280" },
  filterTextActive: { color: "#2563eb" },
  list: { padding: 16 },
  supplyCard: { marginBottom: 8 },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  supplyName: { fontSize: 15, fontWeight: "600", color: "#111827" },
  categoryChipRow: { flexDirection: "row", marginTop: 4 },
  categoryChip: {
    backgroundColor: "#f3f4f6",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  categoryChipText: { fontSize: 11, fontWeight: "500", color: "#6b7280" },
  statusChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusChipText: { fontSize: 12, fontWeight: "600" },
  cardMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 6,
  },
  metaText: { fontSize: 13, color: "#6b7280" },
  metaSep: { fontSize: 13, color: "#d1d5db" },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerText: { fontSize: 13, color: "#374151", fontWeight: "500" },
  footerVendor: { fontSize: 12, color: "#9ca3af" },
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
