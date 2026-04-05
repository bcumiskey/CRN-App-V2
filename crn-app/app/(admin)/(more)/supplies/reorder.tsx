import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  Alert,
} from "react-native";
import { useState, useMemo, useCallback } from "react";
import { useSupplyReorderList, useUpdateSupply } from "../../../../hooks/use-supplies";
import { Card } from "../../../../components/ui/Card";
import { Button } from "../../../../components/ui/Button";
import { EmptyState } from "../../../../components/ui/EmptyState";

function fmt(n: number) {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function SupplyReorderScreen() {
  const reorderQuery = useSupplyReorderList();
  const updateSupply = useUpdateSupply();
  const data = reorderQuery.data;

  const [purchasedIds, setPurchasedIds] = useState<Set<string>>(new Set());

  const groups = useMemo(() => {
    if (!data) return [];
    return data.groups.map((g) => ({
      ...g,
      items: g.items.map((item) => ({
        ...item,
        purchased: purchasedIds.has(item.id),
      })),
    }));
  }, [data, purchasedIds]);

  const handleMarkPurchased = useCallback(
    (item: { id: string; name: string; onHand: number; reorderQuantity: number }) => {
      Alert.alert(
        "Mark Purchased",
        `Add ${item.reorderQuantity} to on-hand for "${item.name}"?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Mark Purchased",
            onPress: () => {
              updateSupply.mutate(
                { id: item.id, onHand: item.onHand + item.reorderQuantity },
                {
                  onSuccess: () => {
                    setPurchasedIds((prev) => new Set(prev).add(item.id));
                  },
                }
              );
            },
          },
        ]
      );
    },
    [updateSupply]
  );

  const handleBulkPurchase = useCallback(() => {
    if (!data) return;
    const allItems = data.groups.flatMap((g) => g.items);
    const unpurchased = allItems.filter((i) => !purchasedIds.has(i.id));
    if (unpurchased.length === 0) return;

    Alert.alert(
      "Bulk Mark Purchased",
      `Mark ${unpurchased.length} items as purchased? This will add reorder quantities to on-hand counts.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Mark All",
          onPress: () => {
            for (const item of unpurchased) {
              updateSupply.mutate(
                { id: item.id, onHand: item.onHand + item.reorderQuantity },
                {
                  onSuccess: () => {
                    setPurchasedIds((prev) => new Set(prev).add(item.id));
                  },
                }
              );
            }
          },
        },
      ]
    );
  }, [data, purchasedIds, updateSupply]);

  return (
    <View style={styles.container}>
      <FlatList
        data={groups}
        keyExtractor={(item) => item.vendor}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={reorderQuery.isRefetching}
            onRefresh={() => {
              reorderQuery.refetch();
              setPurchasedIds(new Set());
            }}
          />
        }
        ListHeaderComponent={
          data && data.grandTotal > 0 ? (
            <View style={styles.header}>
              <View style={styles.grandTotalRow}>
                <Text style={styles.grandTotalLabel}>Reorder Total</Text>
                <Text style={styles.grandTotalValue}>{fmt(data.grandTotal)}</Text>
              </View>
              <Button
                onPress={handleBulkPurchase}
                variant="success"
                fullWidth
                loading={updateSupply.isPending}
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
              <View
                key={item.id}
                style={[styles.reorderItem, item.purchased && styles.reorderItemPurchased]}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.itemName,
                      item.purchased && styles.itemNamePurchased,
                    ]}
                  >
                    {item.name}
                  </Text>
                  <Text style={styles.itemMeta}>
                    On hand: {item.onHand} | Reorder: {item.reorderQuantity} {item.unit}
                  </Text>
                  <Text style={styles.itemCost}>
                    {item.reorderQuantity} {"\u00D7"} {fmt(item.unitCost)} = {fmt(item.lineTotal)}
                  </Text>
                </View>
                {!item.purchased ? (
                  <Button
                    onPress={() => handleMarkPurchased(item)}
                    variant="outline"
                    size="sm"
                  >
                    {"\u2713"}
                  </Button>
                ) : (
                  <View style={styles.purchasedBadge}>
                    <Text style={styles.purchasedBadgeText}>{"\u2713"} Done</Text>
                  </View>
                )}
              </View>
            ))}
          </Card>
        )}
        ListEmptyComponent={
          reorderQuery.isLoading ? null : (
            <EmptyState
              title="All stocked up"
              message="No supplies are at or below their reorder level."
            />
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  list: { padding: 16 },
  header: { marginBottom: 16 },
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
  reorderItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  reorderItemPurchased: { opacity: 0.5 },
  itemName: { fontSize: 14, fontWeight: "500", color: "#111827" },
  itemNamePurchased: { textDecorationLine: "line-through" },
  itemMeta: { fontSize: 12, color: "#9ca3af", marginTop: 2 },
  itemCost: { fontSize: 13, color: "#6b7280", marginTop: 2 },
  purchasedBadge: {
    backgroundColor: "#dcfce7",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  purchasedBadgeText: { fontSize: 12, fontWeight: "600", color: "#16a34a" },
});
