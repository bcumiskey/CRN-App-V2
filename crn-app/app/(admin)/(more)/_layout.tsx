import { Stack } from "expo-router";
export default function MoreLayout() {
  return (
    <Stack screenOptions={{ headerShown: true, headerStyle: { backgroundColor: "#ffffff" }, headerTitleStyle: { fontWeight: "600", color: "#111827" } }}>
      <Stack.Screen name="index" options={{ title: "More" }} />
      <Stack.Screen name="properties" options={{ headerShown: false }} />
      <Stack.Screen name="team" options={{ headerShown: false }} />
      <Stack.Screen name="invoices" options={{ headerShown: false }} />
      <Stack.Screen name="expenses" options={{ headerShown: false }} />
      <Stack.Screen name="mileage" options={{ headerShown: false }} />
      <Stack.Screen name="pay-periods" options={{ headerShown: false }} />
      <Stack.Screen name="reports" options={{ headerShown: false }} />
      <Stack.Screen name="linens" options={{ headerShown: false }} />
      <Stack.Screen name="supplies" options={{ headerShown: false }} />
      <Stack.Screen name="settings" options={{ headerShown: false }} />
      <Stack.Screen name="calendar-sync" options={{ headerShown: false }} />
      <Stack.Screen name="notifications" options={{ title: "Notifications" }} />
    </Stack>
  );
}
