import { Tabs } from "expo-router";
import { View, StyleSheet } from "react-native";
import {
  ClipboardCheck,
  Calendar,
  StickyNote,
  Wallet,
  Menu,
} from "lucide-react-native";

export default function WorkerLayout() {
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
          title: "Today",
          tabBarIcon: ({ color, size }) => (
            <ClipboardCheck size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: "Schedule",
          tabBarIcon: ({ color, size }) => (
            <Calendar size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="add-note"
        options={{
          title: "",
          tabBarIcon: () => (
            <View style={styles.fabContainer}>
              <View style={styles.fab}>
                <StickyNote size={24} color="#ffffff" />
              </View>
            </View>
          ),
          tabBarLabel: () => null,
        }}
      />
      <Tabs.Screen
        name="pay"
        options={{
          title: "My Pay",
          tabBarIcon: ({ color, size }) => (
            <Wallet size={size} color={color} />
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

      {/* Hidden screens */}
      <Tabs.Screen name="jobs/[id]" options={{ href: null, title: "Job" }} />
      <Tabs.Screen name="properties" options={{ href: null, title: "Properties" }} />
      <Tabs.Screen name="properties/[id]" options={{ href: null, title: "Property" }} />
      <Tabs.Screen name="pay/[periodId]" options={{ href: null, title: "Pay Period" }} />
      <Tabs.Screen name="profile" options={{ href: null, title: "Profile" }} />
      <Tabs.Screen name="settings" options={{ href: null, title: "Settings" }} />
      <Tabs.Screen name="notifications" options={{ href: null, title: "Notifications" }} />
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
