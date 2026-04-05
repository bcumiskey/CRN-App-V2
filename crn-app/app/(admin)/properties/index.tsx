import { View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useProperties } from "../../../hooks/use-properties";
import { Card } from "../../../components/ui/Card";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { EmptyState } from "../../../components/ui/EmptyState";

export default function PropertiesScreen() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");

  const propertiesQuery = useProperties({ status: statusFilter, search: search || undefined });
  const properties = propertiesQuery.data ?? [];

  return (
    <View style={styles.container}>
      {/* Search */}
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search properties..."
          placeholderTextColor="#9ca3af"
        />
      </View>

      {/* Filter */}
      <View style={styles.filterRow}>
        {["active", "inactive", "all"].map((status) => (
          <TouchableOpacity
            key={status}
            onPress={() => setStatusFilter(status)}
            style={[styles.filterPill, statusFilter === status && styles.filterPillActive]}
          >
            <Text style={[styles.filterText, statusFilter === status && styles.filterTextActive]}>
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={properties}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => router.push(`/(admin)/properties/${item.id}`)}>
            <Card style={styles.propertyCard}>
              <View style={styles.cardHeader}>
                <Text style={styles.propertyName}>{item.name}</Text>
                <StatusBadge status={item.status} />
              </View>
              {item.address && <Text style={styles.address}>{item.address}</Text>}
              <View style={styles.detailRow}>
                {item.owner && <Text style={styles.detail}>Owner: {item.owner.name}</Text>}
                {item.defaultJobFee && (
                  <Text style={styles.fee}>${item.defaultJobFee.toFixed(2)}</Text>
                )}
              </View>
              {item.houseCutPercent > 0 && (
                <Text style={styles.houseCut}>House Cut: {item.houseCutPercent}%</Text>
              )}
            </Card>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <EmptyState title="No properties" message="Add your first property to get started." />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  searchBar: { paddingHorizontal: 16, paddingTop: 12, backgroundColor: "#ffffff" },
  searchInput: {
    borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 15,
    backgroundColor: "#f9fafb", color: "#111827",
  },
  filterRow: {
    flexDirection: "row", paddingHorizontal: 16, paddingVertical: 10, gap: 8,
    backgroundColor: "#ffffff", borderBottomWidth: 1, borderBottomColor: "#e5e7eb",
  },
  filterPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: "#f3f4f6" },
  filterPillActive: { backgroundColor: "#dbeafe" },
  filterText: { fontSize: 12, fontWeight: "500", color: "#6b7280" },
  filterTextActive: { color: "#2563eb" },
  list: { padding: 16 },
  propertyCard: { marginBottom: 8 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  propertyName: { fontSize: 17, fontWeight: "600", color: "#111827" },
  address: { fontSize: 13, color: "#6b7280", marginBottom: 8 },
  detailRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  detail: { fontSize: 13, color: "#6b7280" },
  fee: { fontSize: 16, fontWeight: "600", color: "#111827" },
  houseCut: { fontSize: 12, color: "#9ca3af", marginTop: 4 },
});
