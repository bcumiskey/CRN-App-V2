import { View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useState, useMemo } from "react";
import { useWorkerProperties } from "../../../hooks/use-worker";
import { Card } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";

export default function WorkerPropertiesScreen() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const propertiesQuery = useWorkerProperties();
  const properties = propertiesQuery.data ?? [];

  const filtered = useMemo(() => {
    if (!search) return properties;
    const q = search.toLowerCase();
    return properties.filter((p) => p.name.toLowerCase().includes(q));
  }, [properties, search]);

  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search properties..."
          placeholderTextColor="#9ca3af"
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => router.push(`/(worker)/properties/${item.id}`)}>
            <Card style={styles.card}>
              <Text style={styles.propName}>{item.name}</Text>
              {item.address && <Text style={styles.address}>{item.address}</Text>}
              {item.lastCleanedDate && (
                <Text style={styles.lastCleaned}>Last cleaned: {item.lastCleanedDate}</Text>
              )}
              {/* NO fee, NO house cut, NO owner info */}
            </Card>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <EmptyState title="No properties" message="You'll see properties here once you're assigned to jobs." />
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
  list: { padding: 16 },
  card: { marginBottom: 8 },
  propName: { fontSize: 17, fontWeight: "600", color: "#111827" },
  address: { fontSize: 13, color: "#6b7280", marginTop: 2 },
  lastCleaned: { fontSize: 12, color: "#9ca3af", marginTop: 4 },
});
