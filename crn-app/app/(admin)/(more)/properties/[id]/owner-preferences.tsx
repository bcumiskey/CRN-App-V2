import { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TextInput,
  Switch,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import {
  useOwnerPreferences,
  useUpdateOwnerPreferences,
  OwnerPreferences,
} from "../../../../../hooks/use-property-profile";
import { Card } from "../../../../../components/ui/Card";
import { Button } from "../../../../../components/ui/Button";

const LAUNDRY_METHODS = ["On-site", "Laundromat", "Service", "Owner Handles"];
const GUEST_COMMS_METHODS = ["App Message", "Text", "Email", "Phone", "None"];

export default function OwnerPreferencesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const prefsQuery = useOwnerPreferences(id);
  const updatePrefs = useUpdateOwnerPreferences();

  const [form, setForm] = useState({
    laundryMethod: "",
    laundryLocation: "",
    laundryNotes: "",
    guestCommsMethod: "",
    photoCheckIn: false,
    photoCheckOut: false,
    preferredTemp: "",
    petPolicy: "",
    earliestArrival: "",
    latestDeparture: "",
    keyReturnMethod: "",
  });

  // Populate form when data loads
  useEffect(() => {
    if (prefsQuery.data) {
      const d = prefsQuery.data;
      setForm({
        laundryMethod: d.laundryMethod ?? "",
        laundryLocation: d.laundryLocation ?? "",
        laundryNotes: d.laundryNotes ?? "",
        guestCommsMethod: d.guestCommsMethod ?? "",
        photoCheckIn: d.photoCheckIn,
        photoCheckOut: d.photoCheckOut,
        preferredTemp: d.preferredTemp ?? "",
        petPolicy: d.petPolicy ?? "",
        earliestArrival: d.earliestArrival ?? "",
        latestDeparture: d.latestDeparture ?? "",
        keyReturnMethod: d.keyReturnMethod ?? "",
      });
    }
  }, [prefsQuery.data?.id]);

  function update(key: keyof typeof form, value: string | boolean) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSave() {
    if (!id) return;
    updatePrefs.mutate(
      {
        propertyId: id,
        laundryMethod: form.laundryMethod || null,
        laundryLocation: form.laundryLocation || null,
        laundryNotes: form.laundryNotes || null,
        guestCommsMethod: form.guestCommsMethod || null,
        photoCheckIn: form.photoCheckIn,
        photoCheckOut: form.photoCheckOut,
        preferredTemp: form.preferredTemp || null,
        petPolicy: form.petPolicy || null,
        earliestArrival: form.earliestArrival || null,
        latestDeparture: form.latestDeparture || null,
        keyReturnMethod: form.keyReturnMethod || null,
      },
      {
        onSuccess: () => {
          Alert.alert("Saved", "Owner preferences updated.");
        },
        onError: () => {
          Alert.alert("Error", "Failed to save preferences.");
        },
      }
    );
  }

  if (prefsQuery.isLoading) {
    return (
      <View style={styles.loading}>
        <Text>Loading preferences...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Laundry */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Laundry</Text>

          <Text style={styles.fieldLabel}>Method</Text>
          <View style={styles.pillRow}>
            {LAUNDRY_METHODS.map((m) => (
              <TouchableOpacity
                key={m}
                onPress={() => update("laundryMethod", m)}
                style={[
                  styles.pill,
                  form.laundryMethod === m && styles.pillActive,
                ]}
              >
                <Text
                  style={[
                    styles.pillText,
                    form.laundryMethod === m && styles.pillTextActive,
                  ]}
                >
                  {m}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.fieldLabel}>Location</Text>
          <TextInput
            style={styles.input}
            value={form.laundryLocation}
            onChangeText={(v) => update("laundryLocation", v)}
            placeholder="e.g. Basement, Garage unit"
            placeholderTextColor="#9ca3af"
          />

          <Text style={styles.fieldLabel}>Notes</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={form.laundryNotes}
            onChangeText={(v) => update("laundryNotes", v)}
            placeholder="Special laundry instructions..."
            placeholderTextColor="#9ca3af"
            multiline
          />
        </Card>

        {/* Guest Communications */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Guest Communications</Text>

          <Text style={styles.fieldLabel}>Preferred Method</Text>
          <View style={styles.pillRow}>
            {GUEST_COMMS_METHODS.map((m) => (
              <TouchableOpacity
                key={m}
                onPress={() => update("guestCommsMethod", m)}
                style={[
                  styles.pill,
                  form.guestCommsMethod === m && styles.pillActive,
                ]}
              >
                <Text
                  style={[
                    styles.pillText,
                    form.guestCommsMethod === m && styles.pillTextActive,
                  ]}
                >
                  {m}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        {/* Photo Requirements */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Photo Requirements</Text>

          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Require check-in photos</Text>
            <Switch
              value={form.photoCheckIn}
              onValueChange={(v) => update("photoCheckIn", v)}
              trackColor={{ false: "#d1d5db", true: "#93c5fd" }}
              thumbColor={form.photoCheckIn ? "#2563eb" : "#f4f4f5"}
            />
          </View>

          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Require check-out photos</Text>
            <Switch
              value={form.photoCheckOut}
              onValueChange={(v) => update("photoCheckOut", v)}
              trackColor={{ false: "#d1d5db", true: "#93c5fd" }}
              thumbColor={form.photoCheckOut ? "#2563eb" : "#f4f4f5"}
            />
          </View>
        </Card>

        {/* Climate */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Climate</Text>
          <Text style={styles.fieldLabel}>Preferred Temperature</Text>
          <TextInput
            style={styles.input}
            value={form.preferredTemp}
            onChangeText={(v) => update("preferredTemp", v)}
            placeholder="e.g. 72F in summer, 68F in winter"
            placeholderTextColor="#9ca3af"
          />
        </Card>

        {/* Pet Policy */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Pet Policy</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={form.petPolicy}
            onChangeText={(v) => update("petPolicy", v)}
            placeholder="e.g. No pets allowed, or Dog-friendly with fee..."
            placeholderTextColor="#9ca3af"
            multiline
          />
        </Card>

        {/* Schedule */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Schedule</Text>

          <Text style={styles.fieldLabel}>Earliest Arrival</Text>
          <TextInput
            style={styles.input}
            value={form.earliestArrival}
            onChangeText={(v) => update("earliestArrival", v)}
            placeholder="e.g. 3:00 PM"
            placeholderTextColor="#9ca3af"
          />

          <Text style={styles.fieldLabel}>Latest Departure</Text>
          <TextInput
            style={styles.input}
            value={form.latestDeparture}
            onChangeText={(v) => update("latestDeparture", v)}
            placeholder="e.g. 11:00 AM"
            placeholderTextColor="#9ca3af"
          />
        </Card>

        {/* Key Return */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Key Return</Text>
          <TextInput
            style={styles.input}
            value={form.keyReturnMethod}
            onChangeText={(v) => update("keyReturnMethod", v)}
            placeholder="e.g. Lockbox code 1234, under mat"
            placeholderTextColor="#9ca3af"
          />
        </Card>
      </ScrollView>

      {/* Save Button */}
      <View style={styles.saveBar}>
        <Button
          onPress={handleSave}
          variant="primary"
          fullWidth
          loading={updatePrefs.isPending}
        >
          Save Preferences
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  loading: { flex: 1, justifyContent: "center", alignItems: "center" },
  content: { padding: 16, paddingBottom: 100 },
  section: { marginBottom: 12 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6b7280",
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#9ca3af",
    marginTop: 10,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  input: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#111827",
    backgroundColor: "#ffffff",
  },
  multiline: { minHeight: 64, textAlignVertical: "top" },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: "#f3f4f6",
  },
  pillActive: { backgroundColor: "#2563eb" },
  pillText: { fontSize: 13, color: "#6b7280", fontWeight: "500" },
  pillTextActive: { color: "#ffffff" },
  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  toggleLabel: { fontSize: 14, color: "#374151" },
  saveBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
});
