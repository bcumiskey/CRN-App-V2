import { Stack } from "expo-router";

export default function PropertyDetailLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#ffffff" },
        headerTitleStyle: { fontWeight: "600", color: "#111827" },
        headerTintColor: "#2563eb",
        headerBackTitle: "Back",
      }}
    >
      <Stack.Screen name="index" options={{ title: "Property" }} />
      <Stack.Screen name="photos" options={{ title: "Photos" }} />
      <Stack.Screen name="checklists" options={{ title: "Checklists" }} />
      <Stack.Screen name="checklist-editor" options={{ title: "Edit Checklist" }} />
      <Stack.Screen name="instructions" options={{ title: "Standing Instructions" }} />
      <Stack.Screen name="owner-preferences" options={{ title: "Owner Preferences" }} />
    </Stack>
  );
}
