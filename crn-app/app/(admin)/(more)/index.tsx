import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert, Platform } from "react-native";
import { useRouter } from "expo-router";
import {
  Building,
  Users,
  FileText,
  Receipt,
  TrendingUp,
  Package,
  Wallet,
  Settings,
  Lock,
} from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import { clearApiSecret } from "../../../services/api";

interface MenuItem {
  key: string;
  label: string;
  icon: LucideIcon;
  route?: string;
  action?: () => void;
  stubbed?: boolean;
}

function lockThisDevice() {
  const message =
    "This removes the saved access passphrase from this device. You'll be asked for it again the next time the app talks to the server.";
  if (Platform.OS === "web") {
    if (typeof window !== "undefined" && window.confirm(message)) {
      void clearApiSecret();
    }
    return;
  }
  Alert.alert("Lock this device", message, [
    { text: "Cancel", style: "cancel" },
    { text: "Lock", style: "destructive", onPress: () => void clearApiSecret() },
  ]);
}

const menuItems: MenuItem[] = [
  { key: "properties", label: "Properties", icon: Building, route: "/(admin)/(more)/properties" },
  { key: "team", label: "Team", icon: Users, route: "/(admin)/(more)/team" },
  { key: "invoicing", label: "Invoicing", icon: FileText, route: "/(admin)/(more)/invoices" },
  { key: "expenses", label: "Expenses", icon: Receipt, route: "/(admin)/(more)/expenses" },
  { key: "mileage", label: "Mileage", icon: Wallet, route: "/(admin)/(more)/mileage" },
  { key: "pay_periods", label: "Pay Periods", icon: Wallet, route: "/(admin)/(more)/pay-periods" },
  { key: "reports", label: "Reports", icon: TrendingUp, route: "/(admin)/(more)/reports" },
  { key: "linens", label: "Linens", icon: Package, route: "/(admin)/(more)/linens" },
  { key: "supplies", label: "Supplies", icon: Package, route: "/(admin)/(more)/supplies" },
  { key: "settings", label: "Settings", icon: Settings, route: "/(admin)/(more)/settings" },
  { key: "lock", label: "Lock this device", icon: Lock, action: lockThisDevice },
];

export default function MoreScreen() {
  const router = useRouter();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {menuItems.map((item) => {
        const Icon = item.icon;
        return (
          <TouchableOpacity
            key={item.key}
            style={styles.menuItem}
            onPress={() => {
              if (item.action) {
                item.action();
              } else if (item.route) {
                router.push(item.route as any);
              }
            }}
            disabled={item.stubbed}
            activeOpacity={0.7}
          >
            <View style={styles.iconBox}>
              <Icon size={22} color={item.stubbed ? "#d1d5db" : "#374151"} />
            </View>
            <Text style={[styles.menuLabel, item.stubbed && styles.menuLabelStubbed]}>
              {item.label}
            </Text>
            {item.stubbed && (
              <View style={styles.comingSoon}>
                <Text style={styles.comingSoonText}>Coming Soon</Text>
              </View>
            )}
            {!item.stubbed && <Text style={styles.chevron}>›</Text>}
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
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  menuLabel: { flex: 1, fontSize: 16, fontWeight: "500", color: "#111827" },
  menuLabelStubbed: { color: "#9ca3af" },
  comingSoon: {
    backgroundColor: "#f3f4f6",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  comingSoonText: { fontSize: 11, color: "#9ca3af", fontWeight: "500" },
  chevron: { fontSize: 22, color: "#d1d5db" },
});
