import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { useRouter } from "expo-router";

interface SettingsItem {
  label: string;
  description: string;
  route?: string;
  stubbed?: boolean;
}

const settingsItems: SettingsItem[] = [
  { label: "Business Info", description: "Company name, contact, address", route: "/(admin)/settings/business" },
  { label: "Financial Model", description: "Bucket percentages and share levels", route: "/(admin)/settings/financial-model" },
  { label: "Preferences", description: "Default views, notifications, display", route: "/(admin)/settings/preferences" },
  { label: "Tab Bar", description: "Customize navigation tab layout", route: "/(admin)/settings/tab-bar" },
  { label: "Job & Invoice Numbering", description: "Prefixes and counters", route: "/(admin)/settings/numbering" },
  { label: "Integrations", description: "Calendar sources, email settings", stubbed: true },
  { label: "About", description: "App version and support", stubbed: true },
];

export default function SettingsScreen() {
  const router = useRouter();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {settingsItems.map((item) => (
        <TouchableOpacity
          key={item.label}
          style={styles.item}
          onPress={() => item.route && router.push(item.route as any)}
          disabled={item.stubbed}
          activeOpacity={0.7}
        >
          <View style={styles.itemInfo}>
            <Text style={[styles.itemLabel, item.stubbed && styles.stubbed]}>
              {item.label}
            </Text>
            <Text style={styles.itemDesc}>{item.description}</Text>
          </View>
          {item.stubbed ? (
            <Text style={styles.comingSoon}>Coming Soon</Text>
          ) : (
            <Text style={styles.chevron}>›</Text>
          )}
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  content: { padding: 16 },
  item: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#ffffff",
    paddingVertical: 16, paddingHorizontal: 16, borderRadius: 12, marginBottom: 8,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 2, elevation: 1,
  },
  itemInfo: { flex: 1 },
  itemLabel: { fontSize: 16, fontWeight: "500", color: "#111827" },
  itemDesc: { fontSize: 13, color: "#9ca3af", marginTop: 2 },
  stubbed: { color: "#9ca3af" },
  comingSoon: { fontSize: 11, color: "#9ca3af", fontWeight: "500" },
  chevron: { fontSize: 22, color: "#d1d5db" },
});
