import { Stack } from "expo-router";
export default function JobsLayout() {
  return (
    <Stack screenOptions={{ headerShown: true, headerStyle: { backgroundColor: "#ffffff" }, headerTitleStyle: { fontWeight: "600", color: "#111827" } }}>
      <Stack.Screen name="index" options={{ title: "Jobs" }} />
      <Stack.Screen name="[id]" options={{ title: "Job Detail" }} />
    </Stack>
  );
}
