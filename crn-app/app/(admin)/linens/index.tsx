import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useState, useMemo, useCallback } from "react";
import {
  useLinens,
  useLinenMatrix,
  useLinenShoppingList,
  useBulkAdjustLinens,
} from "../../../hooks/use-linens";
import { useProperties } from "../../../hooks/use-properties";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { EmptyState } from "../../../components/ui/EmptyState";

function fmt(n: number) {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── View Modes ──────────────────────────────────────────────────────────

const VIEW_MODES = ["Matrix", "By Property", "Shopping List"] as const;
type ViewMode = (typeof VIEW_MODES)[number];

const CATEGORIES = ["All", "Sheets", "Towels", "Bedding", "Pillows", "Bath", "Kitchen"] as const;
type Category = (typeof CATEGORIES)[number];

const STATUS_OPTIONS = ["All", "Deficits Only", "OK Only"] as const;
type StatusFilter = (typeof STATUS_OPTIONS)[number];

// ── Helpers ─────────────────────────────────────────────────────────────

function getStatusInfo(onHand: number, target: number) {
  if (target === 0) return { label: "OK", color: "#16a34a", border: "#bbf7d0", deficit: 0 };
  const deficit = target - onHand;
  if (deficit <= 0) return { label: `OK (+${Math.abs(deficit)})`, color: "#16a34a", border: "#bbf7d0", deficit: 0 };
  const ratio = onHand / target;
  if (ratio >= 0.5) return { label: `-${deficit}`, color: "#d97706", border: "#fde68a", deficit };
  return { label: `-${deficit}`, color: "#dc2626", border: "#fecaca", deficit };
}

// ── Main Screen ─────────────────────────────────────────────────────────

export default function LinensScreen() {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<ViewMode>("Matrix");
  const [category, setCategory] = useState<Category>("All");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | undefined>();

  // Queries
  const linensQuery = useLinens(
    category !== "All" ? { category: category.toLowerCase() } : undefined
  );
  const matrixQuery = useLinenMatrix();
  const shoppingListQuery = useLinenShoppingList();
  const propertiesQuery = useProperties();
  const bulkAdjust = useBulkAdjustLinens();

  const linens = linensQuery.data ?? [];
  const matrix = matrixQuery.data;
  const shoppingList = shoppingListQuery.data;
  const properties = propertiesQuery.data ?? [];

  // Filtered matrix items
  const filteredItems = useMemo(() => {
    if (!matrix) return [];
    let items = matrix.items;
    if (category !== "All") {
      items = items.filter((i) => i.category.toLowerCase() === category.toLowerCase());
    }
    if (statusFilter === "Deficits Only") {
      items = items.filter((i) => i.status !== "ok");
    } else if (statusFilter === "OK Only") {
      items = items.filter((i) => i.status === "ok");
    }
    return items;
  }, [matrix, category, statusFilter]);

  // By Property: filter linens for a specific property
  const propertyLinens = useMemo(() => {
    if (!selectedPropertyId) return [];
    return linens
      .filter((l) => l.requirements.some((r) => r.propertyId === selectedPropertyId))
      .map((l) => {
        const req = l.requirements.find((r) => r.propertyId === selectedPropertyId);
        return { ...l, quantityPerFlip: req?.quantityPerFlip ?? 0 };
      });
  }, [linens, selectedPropertyId]);

  // Group property linens by category
  const propertyLinensByCategory = useMemo(() => {
    const map: Record<string, typeof propertyLinens> = {};
    for (const item of propertyLinens) {
      const cat = item.category || "Other";
      if (!map[cat]) map[cat] = [];
      map[cat].push(item);
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [propertyLinens]);

  const handleRefresh = useCallback(() => {
    linensQuery.refetch();
    matrixQuery.refetch();
    shoppingListQuery.refetch();
  }, [linensQuery, matrixQuery, shoppingListQuery]);

  const handleMarkAllPurchased = useCallback(() => {
    if (!shoppingList) return;
    const adjustments = shoppingList.groups.flatMap((g) =>
      g.items.map((item) => ({ id: item.id, addQuantity: item.deficit }))
    );
    if (adjustments.length === 0) return;
    Alert.alert(
      "Confirm Purchase",
      `Mark ${adjustments.length} items as purchased? This will add deficit quantities to on-hand counts.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Mark Purchased",
          onPress: () => bulkAdjust.mutate({ adjustments }),
        },
      ]
    );
  }, [shoppingList, bulkAdjust]);

  return (
    <View style={styles.container}>
      {/* View Mode Toggle */}
      <View style={styles.tabRow}>
        {VIEW_MODES.map((mode) => (
          <TouchableOpacity
            key={mode}
            onPress={() => setViewMode(mode)}
            style={[styles.tab, viewMode === mode && styles.tabActive]}
          >
            <Text style={[styles.tabText, viewMode === mode && styles.tabTextActive]}>
              {mode}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* View Content */}
      {viewMode === "Matrix" && (
        <MatrixView
          items={filteredItems}
          category={category}
          statusFilter={statusFilter}
          onCategoryChange={setCategory}
          onStatusChange={setStatusFilter}
          onItemPress={(id) => router.push(`/(admin)/linens/${id}`)}
          refreshing={matrixQuery.isRefetching}
          onRefresh={handleRefresh}
          isLoading={matrixQuery.isLoading}
        />
      )}

      {viewMode === "By Property" && (
        <ByPropertyView
          properties={properties}
          selectedPropertyId={selectedPropertyId}
          onPropertyChange={setSelectedPropertyId}
          groupedLinens={propertyLinensByCategory}
          refreshing={linensQuery.isRefetching}
          onRefresh={handleRefresh}
        />
      )}

      {viewMode === "Shopping List" && (
        <ShoppingListView
          data={shoppingList}
          isLoading={shoppingListQuery.isLoading}
          refreshing={shoppingListQuery.isRefetching}
          onRefresh={handleRefresh}
          onMarkAllPurchased={handleMarkAllPurchased}
          isPurchasing={bulkAdjust.isPending}
        />
      )}
    </View>
  );
}

// ── Matrix View ─────────────────────────────────────────────────────────

function MatrixView({
  items,
  category,
  statusFilter,
  onCategoryChange,
  onStatusChange,
  onItemPress,
  refreshing,
  onRefresh,
  isLoading,
}: {
  items: Array<{ id: string; name: string; code: string; category: string; onHand: number; target: number; status: string }>;
  category: Category;
  statusFilter: StatusFilter;
  onCategoryChange: (c: Category) => void;
  onStatusChange: (s: StatusFilter) => void;
  onItemPress: (id: string) => void;
  refreshing: boolean;
  onRefresh: () => void;
  isLoading: boolean;
}) {
  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListHeaderComponent={
        <>
          {/* Category Filters */}
          <View style={styles.filterRow}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                onPress={() => onCategoryChange(cat)}
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
                onPress={() => onStatusChange(opt)}
                style={[styles.filterPill, statusFilter === opt && styles.filterPillActive]}
              >
                <Text style={[styles.filterText, statusFilter === opt && styles.filterTextActive]}>
                  {opt}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      }
      renderItem={({ item }) => {
        const info = getStatusInfo(item.onHand, item.target);
        return (
          <TouchableOpacity onPress={() => onItemPress(item.id)}>
            <Card style={[styles.itemCard, { borderLeftWidth: 4, borderLeftColor: info.border }]}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemCode}>{item.code}</Text>
                </View>
                <View style={[styles.statusChip, { backgroundColor: info.border }]}>
                  <Text style={[styles.statusChipText, { color: info.color }]}>
                    {info.deficit > 0 ? "\u26A0" : "\u2713"} {info.label}
                  </Text>
                </View>
              </View>
              <View style={styles.cardMeta}>
                <Text style={styles.metaText}>On Hand: {item.onHand}</Text>
                <Text style={styles.metaSep}>{"|"}</Text>
                <Text style={styles.metaText}>Target: {item.target}</Text>
              </View>
            </Card>
          </TouchableOpacity>
        );
      }}
      ListEmptyComponent={
        isLoading ? null : (
          <EmptyState title="No linens" message="Add linen items to track inventory." />
        )
      }
    />
  );
}

// ── By Property View ────────────────────────────────────────────────────

function ByPropertyView({
  properties,
  selectedPropertyId,
  onPropertyChange,
  groupedLinens,
  refreshing,
  onRefresh,
}: {
  properties: Array<{ id: string; name: string }>;
  selectedPropertyId: string | undefined;
  onPropertyChange: (id: string) => void;
  groupedLinens: Array<[string, Array<{ id: string; name: string; quantityPerFlip: number }>]>;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  return (
    <FlatList
      data={groupedLinens}
      keyExtractor={([cat]) => cat}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListHeaderComponent={
        <View style={styles.propertyPickerRow}>
          <Text style={styles.pickerLabel}>Property:</Text>
          <FlatList
            data={properties}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(p) => p.id}
            contentContainerStyle={styles.propertyPills}
            renderItem={({ item: p }) => (
              <TouchableOpacity
                onPress={() => onPropertyChange(p.id)}
                style={[
                  styles.filterPill,
                  selectedPropertyId === p.id && styles.filterPillActive,
                ]}
              >
                <Text
                  style={[
                    styles.filterText,
                    selectedPropertyId === p.id && styles.filterTextActive,
                  ]}
                >
                  {p.name}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>
      }
      renderItem={({ item: [categoryName, items] }) => (
        <Card style={styles.groupCard}>
          <Text style={styles.groupTitle}>{categoryName}</Text>
          {items.map((linen) => (
            <View key={linen.id} style={styles.propertyLinenRow}>
              <Text style={styles.propertyLinenName}>{linen.name}</Text>
              <Text style={styles.propertyLinenQty}>{"\u00D7"} {linen.quantityPerFlip} per flip</Text>
            </View>
          ))}
        </Card>
      )}
      ListEmptyComponent={
        !selectedPropertyId ? (
          <EmptyState title="Select a property" message="Choose a property above to see linen requirements." />
        ) : (
          <EmptyState title="No requirements" message="This property has no linen requirements yet." />
        )
      }
    />
  );
}

// ── Shopping List View ──────────────────────────────────────────────────

function ShoppingListView({
  data,
  isLoading,
  refreshing,
  onRefresh,
  onMarkAllPurchased,
  isPurchasing,
}: {
  data: { groups: Array<{ vendor: string; items: Array<{ id: string; name: string; deficit: number; unitCost: number; lineTotal: number }>; groupTotal: number }>; grandTotal: number } | undefined;
  isLoading: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  onMarkAllPurchased: () => void;
  isPurchasing: boolean;
}) {
  const allItems = useMemo(() => {
    if (!data) return [];
    return data.groups.map((g) => ({ key: g.vendor, ...g }));
  }, [data]);

  return (
    <FlatList
      data={allItems}
      keyExtractor={(item) => item.key}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListHeaderComponent={
        data && data.grandTotal > 0 ? (
          <View style={styles.shoppingHeader}>
            <View style={styles.grandTotalRow}>
              <Text style={styles.grandTotalLabel}>Grand Total</Text>
              <Text style={styles.grandTotalValue}>{fmt(data.grandTotal)}</Text>
            </View>
            <Button
              onPress={onMarkAllPurchased}
              variant="success"
              loading={isPurchasing}
              fullWidth
            >
              Mark All Purchased
            </Button>
          </View>
        ) : null
      }
      renderItem={({ item: group }) => (
        <Card style={styles.vendorCard}>
          <View style={styles.vendorHeader}>
            <Text style={styles.vendorName}>{group.vendor || "No Vendor"}</Text>
            <Text style={styles.vendorTotal}>{fmt(group.groupTotal)}</Text>
          </View>
          {group.items.map((item) => (
            <View key={item.id} style={styles.shoppingItem}>
              <View style={{ flex: 1 }}>
                <Text style={styles.shoppingItemName}>{item.name}</Text>
                <Text style={styles.shoppingItemMeta}>
                  Qty: {item.deficit} {"\u00D7"} {fmt(item.unitCost)}
                </Text>
              </View>
              <Text style={styles.shoppingItemTotal}>{fmt(item.lineTotal)}</Text>
            </View>
          ))}
        </Card>
      )}
      ListEmptyComponent={
        isLoading ? null : (
          <EmptyState title="No items needed" message="All linen inventory levels are at or above target." />
        )
      }
    />
  );
}

// ── Styles ──────────────────────────────────────────────────────────────

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
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
  },
  tabActive: { backgroundColor: "#dbeafe" },
  tabText: { fontSize: 13, fontWeight: "500", color: "#6b7280" },
  tabTextActive: { color: "#2563eb", fontWeight: "600" },
  list: { padding: 16 },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
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
  itemCard: { marginBottom: 8 },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  itemName: { fontSize: 15, fontWeight: "600", color: "#111827" },
  itemCode: { fontSize: 12, color: "#9ca3af", marginTop: 2 },
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
  },
  metaText: { fontSize: 13, color: "#6b7280" },
  metaSep: { fontSize: 13, color: "#d1d5db" },
  // By Property
  propertyPickerRow: {
    marginBottom: 16,
  },
  pickerLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  propertyPills: { gap: 8 },
  groupCard: { marginBottom: 12 },
  groupTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  propertyLinenRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  propertyLinenName: { fontSize: 14, color: "#111827", fontWeight: "500" },
  propertyLinenQty: { fontSize: 13, color: "#6b7280" },
  // Shopping List
  shoppingHeader: { marginBottom: 16 },
  grandTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  grandTotalLabel: { fontSize: 16, fontWeight: "600", color: "#374151" },
  grandTotalValue: { fontSize: 22, fontWeight: "700", color: "#111827" },
  vendorCard: { marginBottom: 12 },
  vendorHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  vendorName: { fontSize: 16, fontWeight: "600", color: "#111827" },
  vendorTotal: { fontSize: 15, fontWeight: "700", color: "#2563eb" },
  shoppingItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  shoppingItemName: { fontSize: 14, color: "#111827", fontWeight: "500" },
  shoppingItemMeta: { fontSize: 12, color: "#9ca3af", marginTop: 2 },
  shoppingItemTotal: { fontSize: 14, fontWeight: "600", color: "#111827" },
});
