import { useCallback } from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert, Platform } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { Building, User, Settings, HelpCircle, Lock, LogOut } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import { clearApiSecret, clearWorkerSession, requestWorkerLogin } from "../../services/api";
import { useWorkerSession } from "../../hooks/use-worker-session";

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

const baseMenuItems: MenuItem[] = [
  { key: "properties", label: "Properties", icon: Building, route: "/(worker)/properties" },
  { key: "profile", label: "My Profile", icon: User, route: "/(worker)/profile" },
  { key: "settings", label: "My Settings", icon: Settings, route: "/(worker)/settings" },
];

export default function WorkerMoreScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  // With no worker token stored (today's production) this stays signed-out
  // and the menu renders exactly as before — zero behavior change.
  const { isSignedIn, user } = useWorkerSession();

  const logOut = useCallback(() => {
    const doLogout = async () => {
      await clearWorkerSession();
      // Drop everything this worker had loaded before the next sign-in.
      queryClient.clear();
      requestWorkerLogin();
    };
    const message =
      "This signs you out on this device. You'll need your email and password to sign back in.";
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.confirm(message)) {
        void doLogout();
      }
      return;
    }
    Alert.alert("Log out", message, [
      { text: "Cancel", style: "cancel" },
      { text: "Log out", style: "destructive", onPress: () => void doLogout() },
    ]);
  }, [queryClient]);

  const menuItems: MenuItem[] = [
    ...baseMenuItems,
    // Worker sessions log out; admin-secret devices keep the v2.4 lock action.
    isSignedIn
      ? { key: "logout", label: "Log out", icon: LogOut, action: logOut }
      : { key: "lock", label: "Lock this device", icon: Lock, action: lockThisDevice },
    { key: "help", label: "Help", icon: HelpCircle, stubbed: true },
  ];

  const workerName = user?.name?.trim() || "Team member";

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {isSignedIn && (
        <View style={styles.identityCard}>
          <View style={styles.identityAvatar}>
            <Text style={styles.identityInitial}>
              {workerName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.identityInfo}>
            <Text style={styles.identityName}>{workerName}</Text>
            <Text style={styles.identityMeta}>Signed in</Text>
          </View>
        </View>
      )}
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
  identityCard: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#ffffff",
    paddingVertical: 16, paddingHorizontal: 16, borderRadius: 12, marginBottom: 16,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 2, elevation: 1,
  },
  identityAvatar: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: "#eff6ff",
    alignItems: "center", justifyContent: "center", marginRight: 14,
  },
  identityInitial: { fontSize: 20, fontWeight: "700", color: "#2563eb" },
  identityInfo: { flex: 1 },
  identityName: { fontSize: 17, fontWeight: "600", color: "#111827" },
  identityMeta: { fontSize: 13, color: "#6b7280", marginTop: 2 },
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
