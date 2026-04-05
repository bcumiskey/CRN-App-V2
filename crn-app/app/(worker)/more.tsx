import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Building, User, Settings, HelpCircle } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";

interface MenuItem {
  key: string;
  label: string;
  icon: LucideIcon;
  route?: string;
  stubbed?: boolean;
}

const menuItems: MenuItem[] = [
  { key: "properties", label: "Properties", icon: Building, route: "/(worker)/properties" },
  { key: "profile", label: "My Profile", icon: User, route: "/(worker)/profile" },
  { key: "settings", label: "My Settings", icon: Settings, route: "/(worker)/settings" },
  { key: "help", label: "Help", icon: HelpCircle, stubbed: true },
];

export default function WorkerMoreScreen() {
  const router = useRouter();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {menuItems.map((item) => {
        const Icon = item.icon;
        return (
          <TouchableOpacity
            key={item.key}
            style={styles.menuItem}
            onPress={() => item.route && router.push(item.route as any)}
            disabled={item.stubbed}
            activeOpacity={0.7}
          >
            <View style={styles.iconBox}>
              <Icon size={22} color={item.stubbed ? "#d1d5db" : "#374151"} />
            </View>
            <Text style={[styles.menuLabel, item.stubbed && styles.stubbed]}>{item.label}</Text>
            {item.stubbed ? (
              <Text style={styles.comingSoon}>Coming Soon</Text>
            ) : (
              <Text style={styles.chevron}>›</Text>
            )}
          </TouchableOpacity>
        );
      })}
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
  stubbed: { color: "#9ca3af" },
  comingSoon: { fontSize: 11, color: "#9ca3af", fontWeight: "500" },
  chevron: { fontSize: 22, color: "#d1d5db" },
});
