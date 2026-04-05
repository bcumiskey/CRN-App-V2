import { Stack } from "expo-router";
export default function QuickAddLayout() {
  return <Stack screenOptions={{ headerShown: true, headerStyle: { backgroundColor: "#ffffff" }, headerTitleStyle: { fontWeight: "600", color: "#111827" } }}>
    <Stack.Screen name="index" options={{ title: "New Job" }} />
  </Stack>;
}
