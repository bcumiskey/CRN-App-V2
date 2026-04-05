import {
  View,
  Text,
  ScrollView,
  TextInput,
  Switch,
  TouchableOpacity,
  Alert,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useCreateCalendarSource } from "../../../../hooks/use-calendar-sync";
import { useProperties } from "../../../../hooks/use-properties";
import { Card } from "../../../../components/ui/Card";
import { Button } from "../../../../components/ui/Button";

const SOURCE_TYPES = [
  { value: "turno_ical", label: "Turno iCal" },
  { value: "google_ical", label: "Google iCal" },
] as const;

const INTERVAL_OPTIONS = [
  { value: 15, label: "15 min" },
  { value: 30, label: "30 min" },
  { value: 60, label: "1 hour" },
  { value: 240, label: "4 hours" },
  { value: 1440, label: "Daily" },
  { value: 0, label: "Manual only" },
] as const;

export default function AddCalendarSourceScreen() {
  const router = useRouter();
  const createSource = useCreateCalendarSource();
  const propertiesQuery = useProperties({ status: "active" });
  const properties = propertiesQuery.data ?? [];

  const [name, setName] = useState("");
  const [type, setType] = useState<string>("turno_ical");
  const [url, setUrl] = useState("");
  const [propertyId, setPropertyId] = useState<string | null>(null);
  const [syncIntervalMinutes, setSyncIntervalMinutes] = useState(60);
  const [isActive, setIsActive] = useState(true);
  const [showPropertyPicker, setShowPropertyPicker] = useState(false);

  const selectedProperty = properties.find((p) => p.id === propertyId);

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert("Missing Name", "Please enter a name for this source.");
      return;
    }
    if (!url.trim()) {
      Alert.alert("Missing URL", "Please enter the calendar feed URL.");
      return;
    }
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      Alert.alert("Invalid URL", "Please enter a valid URL starting with https://");
      return;
    }

    createSource.mutate(
      {
        name: name.trim(),
        type,
        url: url.trim(),
        propertyId,
        syncIntervalMinutes,
        isActive,
      },
      {
        onSuccess: () => router.back(),
        onError: (err: any) =>
          Alert.alert("Error", err?.message ?? "Failed to create calendar source."),
      }
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Add Calendar Source</Text>

        {/* Name */}
        <Card style={styles.section}>
          <Text style={styles.fieldLabel}>Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Turno Main Feed"
            placeholderTextColor="#9ca3af"
          />
        </Card>

        {/* Type */}
        <Card style={styles.section}>
          <Text style={styles.fieldLabel}>Type</Text>
          <View style={styles.pillRow}>
            {SOURCE_TYPES.map((t) => (
              <TouchableOpacity
                key={t.value}
                style={[styles.pill, type === t.value && styles.pillActive]}
                onPress={() => setType(t.value)}
              >
                <Text
                  style={[
                    styles.pillText,
                    type === t.value && styles.pillTextActive,
                  ]}
                >
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        {/* Feed URL */}
        <Card style={styles.section}>
          <Text style={styles.fieldLabel}>Feed URL</Text>
          <TextInput
            style={styles.input}
            value={url}
            onChangeText={setUrl}
            placeholder="https://..."
            placeholderTextColor="#9ca3af"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
        </Card>

        {/* Property Picker */}
        <Card style={styles.section}>
          <Text style={styles.fieldLabel}>Property</Text>
          <TouchableOpacity
            style={styles.pickerButton}
            onPress={() => setShowPropertyPicker(!showPropertyPicker)}
          >
            <Text
              style={[
                styles.pickerButtonText,
                !selectedProperty && !propertyId && styles.pickerPlaceholder,
              ]}
            >
              {propertyId === null
                ? "Multi-property (spans multiple properties)"
                : selectedProperty
                ? selectedProperty.name
                : "Select a property..."}
            </Text>
            <Text style={styles.pickerChevron}>
              {showPropertyPicker ? "\u25B2" : "\u25BC"}
            </Text>
          </TouchableOpacity>

          {showPropertyPicker && (
            <View style={styles.pickerList}>
              <TouchableOpacity
                style={[
                  styles.pickerOption,
                  propertyId === null && styles.pickerOptionActive,
                ]}
                onPress={() => {
                  setPropertyId(null);
                  setShowPropertyPicker(false);
                }}
              >
                <Text
                  style={[
                    styles.pickerOptionText,
                    propertyId === null && styles.pickerOptionTextActive,
                  ]}
                >
                  Multi-property
                </Text>
              </TouchableOpacity>
              {propertiesQuery.isLoading ? (
                <ActivityIndicator size="small" color="#2563eb" style={{ padding: 12 }} />
              ) : (
                properties.map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    style={[
                      styles.pickerOption,
                      propertyId === p.id && styles.pickerOptionActive,
                    ]}
                    onPress={() => {
                      setPropertyId(p.id);
                      setShowPropertyPicker(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.pickerOptionText,
                        propertyId === p.id && styles.pickerOptionTextActive,
                      ]}
                    >
                      {p.name}
                    </Text>
                  </TouchableOpacity>
                ))
              )}
            </View>
          )}
        </Card>

        {/* Sync Interval */}
        <Card style={styles.section}>
          <Text style={styles.fieldLabel}>Auto-sync Interval</Text>
          <View style={styles.pillRow}>
            {INTERVAL_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.pill,
                  syncIntervalMinutes === opt.value && styles.pillActive,
                ]}
                onPress={() => setSyncIntervalMinutes(opt.value)}
              >
                <Text
                  style={[
                    styles.pillText,
                    syncIntervalMinutes === opt.value && styles.pillTextActive,
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        {/* Active Toggle */}
        <Card style={styles.section}>
          <View style={styles.toggleRow}>
            <View>
              <Text style={styles.toggleLabel}>Active</Text>
              <Text style={styles.toggleHint}>
                Enable auto-sync on this schedule
              </Text>
            </View>
            <Switch
              value={isActive}
              onValueChange={setIsActive}
              trackColor={{ false: "#d1d5db", true: "#93c5fd" }}
              thumbColor={isActive ? "#2563eb" : "#f3f4f6"}
            />
          </View>
        </Card>

        {/* Actions */}
        <View style={styles.actions}>
          <Button
            onPress={handleSave}
            variant="primary"
            size="lg"
            fullWidth
            loading={createSource.isPending}
          >
            Save Source
          </Button>
          <Button onPress={() => router.back()} variant="ghost" size="md" fullWidth>
            Cancel
          </Button>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  content: { padding: 16 },
  title: { fontSize: 22, fontWeight: "700", color: "#111827", marginBottom: 16 },
  section: { marginBottom: 16 },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: "#374151",
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: "#111827",
    backgroundColor: "#ffffff",
  },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#f3f4f6",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  pillActive: { backgroundColor: "#dbeafe", borderColor: "#2563eb" },
  pillText: { fontSize: 13, fontWeight: "500", color: "#6b7280" },
  pillTextActive: { color: "#2563eb" },
  pickerButton: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#ffffff",
  },
  pickerButtonText: { fontSize: 15, color: "#111827", flex: 1 },
  pickerPlaceholder: { color: "#9ca3af" },
  pickerChevron: { fontSize: 10, color: "#9ca3af", marginLeft: 8 },
  pickerList: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    backgroundColor: "#ffffff",
    maxHeight: 200,
  },
  pickerOption: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  pickerOptionActive: { backgroundColor: "#eff6ff" },
  pickerOptionText: { fontSize: 14, color: "#374151" },
  pickerOptionTextActive: { color: "#2563eb", fontWeight: "600" },
  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  toggleLabel: { fontSize: 15, fontWeight: "600", color: "#111827" },
  toggleHint: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  actions: { gap: 10, marginTop: 8 },
});
