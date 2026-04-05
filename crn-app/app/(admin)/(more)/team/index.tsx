import { View, Text, FlatList, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useTeam } from "../../../../hooks/use-team";
import { Card } from "../../../../components/ui/Card";
import { StatusBadge } from "../../../../components/ui/StatusBadge";
import { EmptyState } from "../../../../components/ui/EmptyState";

export default function TeamScreen() {
  const router = useRouter();
  const [showArchived, setShowArchived] = useState(false);

  const teamQuery = useTeam({ status: showArchived ? "all" : undefined });
  const members = teamQuery.data ?? [];

  const shareLabel = (share: number) => {
    if (share === 1) return "Full";
    if (share === 0.75) return "3/4";
    if (share === 0.5) return "Half";
    return `${share}`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => setShowArchived(!showArchived)}
          style={styles.toggle}
        >
          <Text style={styles.toggleText}>
            {showArchived ? "Hide Archived" : "Show All"}
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={members}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => router.push(`/(admin)/team/${item.id}`)}>
            <Card style={[styles.card, item.status === "archived" && styles.cardArchived]}>
              <View style={styles.cardRow}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {item.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.info}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.detail}>
                    {item.role === "admin" ? "Admin" : "Worker"} • Default: {shareLabel(item.defaultShare)}
                    {item.isOwner ? " • Owner" : ""}
                  </Text>
                </View>
                <StatusBadge status={item.status} />
              </View>
            </Card>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <EmptyState title="No team members" message="Add your first team member to get started." />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  header: {
    flexDirection: "row", justifyContent: "flex-end", paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: "#ffffff", borderBottomWidth: 1, borderBottomColor: "#e5e7eb",
  },
  toggle: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: "#f3f4f6" },
  toggleText: { fontSize: 12, fontWeight: "500", color: "#6b7280" },
  list: { padding: 16 },
  card: { marginBottom: 8 },
  cardArchived: { opacity: 0.5 },
  cardRow: { flexDirection: "row", alignItems: "center" },
  avatar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: "#dbeafe",
    alignItems: "center", justifyContent: "center", marginRight: 12,
  },
  avatarText: { fontSize: 18, fontWeight: "600", color: "#2563eb" },
  info: { flex: 1 },
  name: { fontSize: 16, fontWeight: "600", color: "#111827" },
  detail: { fontSize: 13, color: "#6b7280", marginTop: 2 },
});
