import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { useMileage, useMileageSummary } from "../../../hooks/use-mileage";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { EmptyState } from "../../../components/ui/EmptyState";

function fmt(n: number) {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function MileageScreen() {
  const router = useRouter();

  const mileageQuery = useMileage();
  const entries = mileageQuery.data ?? [];

  const summaryQuery = useMileageSummary();
  const summary = summaryQuery.data;

  return (
    <View style={styles.container}>
      <FlatList
        data={entries}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={mileageQuery.isRefetching}
            onRefresh={() => {
              mileageQuery.refetch();
              summaryQuery.refetch();
            }}
          />
        }
        ListHeaderComponent={
          <>
            {/* Summary Card */}
            {summary && (
              <Card style={styles.summaryCard}>
                <View style={styles.summaryRow}>
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>Total Miles</Text>
                    <Text style={styles.summaryValue}>
                      {summary.totalMiles.toLocaleString("en-US", { maximumFractionDigits: 1 })}
                    </Text>
                  </View>
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>Total Deduction</Text>
                    <Text style={[styles.summaryValue, { color: "#16a34a" }]}>
                      {fmt(summary.totalDeduction)}
                    </Text>
                  </View>
                </View>
                <View style={styles.rateRow}>
                  <Text style={styles.rateLabel}>IRS Rate</Text>
                  <Text style={styles.rateValue}>${summary.currentRate}/mile</Text>
                </View>
              </Card>
            )}

            {/* Action */}
            <View style={styles.actionRow}>
              <Button
                onPress={() => router.push("/(admin)/mileage/add")}
                variant="primary"
                size="md"
              >
                + Add Mileage
              </Button>
            </View>
          </>
        }
        renderItem={({ item }) => (
          <Card style={styles.entryCard}>
            <View style={styles.entryTop}>
              <Text style={styles.entryDate}>{item.date}</Text>
              <Text style={styles.entryMiles}>
                {item.miles.toFixed(1)} mi
              </Text>
            </View>
            <View style={styles.entryMiddle}>
              <Text style={styles.locationText} numberOfLines={1}>
                {item.startLocation || "Start"} → {item.endLocation || "End"}
              </Text>
            </View>
            <View style={styles.entryBottom}>
              {item.purpose && (
                <Text style={styles.purposeText} numberOfLines={1}>{item.purpose}</Text>
              )}
              <Text style={styles.deductionText}>{fmt(item.deductionAmount)}</Text>
            </View>
          </Card>
        )}
        ListEmptyComponent={
          mileageQuery.isLoading ? null : (
            <EmptyState
              title="No mileage entries"
              message="Track your business mileage for tax deductions."
              actionLabel="Add Mileage"
              onAction={() => router.push("/(admin)/mileage/add")}
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
  summaryCard: { marginBottom: 16 },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  summaryItem: {},
  summaryLabel: { fontSize: 12, color: "#6b7280", marginBottom: 4 },
  summaryValue: { fontSize: 22, fontWeight: "700", color: "#111827" },
  rateRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
    paddingTop: 10,
  },
  rateLabel: { fontSize: 13, color: "#6b7280" },
  rateValue: { fontSize: 14, fontWeight: "600", color: "#374151" },
  actionRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 16,
  },
  entryCard: { marginBottom: 8 },
  entryTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  entryDate: { fontSize: 12, color: "#9ca3af" },
  entryMiles: { fontSize: 16, fontWeight: "700", color: "#111827" },
  entryMiddle: { marginBottom: 4 },
  locationText: { fontSize: 14, color: "#374151" },
  entryBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  purposeText: { fontSize: 12, color: "#6b7280", flex: 1, marginRight: 8 },
  deductionText: { fontSize: 14, fontWeight: "600", color: "#16a34a" },
});
