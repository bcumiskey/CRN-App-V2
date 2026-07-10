import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { User } from "lucide-react-native";
import Constants from "expo-constants";
import { Card } from "../../components/ui/Card";
import { API_BASE } from "../../services/api";

export default function WorkerSettingsScreen() {
  const router = useRouter();
  const appVersion = Constants.expoConfig?.version ?? "unknown";

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity
        style={styles.menuItem}
        onPress={() => router.push("/(worker)/profile")}
        activeOpacity={0.7}
      >
        <View style={styles.iconBox}>
          <User size={22} color="#374151" />
        </View>
        <Text style={styles.menuLabel}>My Profile</Text>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>

      <Card style={styles.aboutCard}>
        <Text style={styles.sectionTitle}>About</Text>
        <View style={styles.aboutRow}>
          <Text style={styles.aboutLabel}>App Version</Text>
          <Text style={styles.aboutValue}>{appVersion}</Text>
        </View>
        <View style={styles.aboutRow}>
          <Text style={styles.aboutLabel}>API</Text>
          <Text style={styles.aboutValue} numberOfLines={1}>{API_BASE}</Text>
        </View>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  content: { padding: 16 },
  menuItem: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#ffffff",
    paddingVertical: 16, paddingHorizontal: 16, borderRadius: 12, marginBottom: 8,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 2, elevation: 1,
  },
  iconBox: { width: 40, height: 40, borderRadius: 10, backgroundColor: "#f3f4f6", alignItems: "center", justifyContent: "center", marginRight: 14 },
  menuLabel: { flex: 1, fontSize: 16, fontWeight: "500", color: "#111827" },
  chevron: { fontSize: 22, color: "#d1d5db" },
  aboutCard: { marginTop: 8 },
  sectionTitle: { fontSize: 13, fontWeight: "600", color: "#6b7280", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 },
  aboutRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 6 },
  aboutLabel: { fontSize: 14, color: "#374151" },
  aboutValue: { fontSize: 13, color: "#6b7280", maxWidth: "65%" },
});
