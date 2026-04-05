import { Tabs, useRouter } from "expo-router";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import {
  LayoutDashboard,
  ClipboardList,
  Plus,
  Calendar,
  Menu,
} from "lucide-react-native";

export default function AdminLayout() {
  const router = useRouter();

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: "#ffffff" },
        headerTitleStyle: { fontWeight: "600", color: "#111827" },
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: "#2563eb",
        tabBarInactiveTintColor: "#9ca3af",
        tabBarLabelStyle: { fontSize: 11, fontWeight: "500" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color, size }) => (
            <LayoutDashboard size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="jobs"
        options={{
          title: "Jobs",
          tabBarIcon: ({ color, size }) => (
            <ClipboardList size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="quick-add"
        options={{
          title: "",
          tabBarIcon: () => (
            <View style={styles.fabContainer}>
              <TouchableOpacity
                style={styles.fab}
                onPress={() => router.push("/(admin)/quick-add")}
                activeOpacity={0.8}
              >
                <Plus size={28} color="#ffffff" />
              </TouchableOpacity>
            </View>
          ),
          tabBarLabel: () => null,
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: "Calendar",
          tabBarIcon: ({ color, size }) => (
            <Calendar size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: "More",
          tabBarIcon: ({ color, size }) => (
            <Menu size={size} color={color} />
          ),
        }}
      />

      {/* Hidden screens — accessible via navigation but not in tab bar */}
      <Tabs.Screen
        name="properties"
        options={{ href: null, title: "Properties" }}
      />
      <Tabs.Screen
        name="team"
        options={{ href: null, title: "Team" }}
      />
      <Tabs.Screen
        name="settings"
        options={{ href: null, title: "Settings" }}
      />
      <Tabs.Screen
        name="invoices"
        options={{ href: null, title: "Invoices" }}
      />
      <Tabs.Screen
        name="expenses"
        options={{ href: null, title: "Expenses" }}
      />
      <Tabs.Screen
        name="mileage"
        options={{ href: null, title: "Mileage" }}
      />
      <Tabs.Screen
        name="pay-periods"
        options={{ href: null, title: "Pay Periods" }}
      />
      <Tabs.Screen
        name="reports"
        options={{ href: null, title: "Reports" }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    height: 80,
    paddingBottom: 20,
    paddingTop: 8,
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  fabContainer: {
    position: "relative",
    top: -16,
    alignItems: "center",
    justifyContent: "center",
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#2563eb",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
});
