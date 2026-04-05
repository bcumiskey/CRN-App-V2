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
import { useRouter, useLocalSearchParams } from "expo-router";
import { useState, useEffect } from "react";
import {
  useCalendarSource,
  useUpdateCalendarSource,
  useDeleteCalendarSource,
  useSyncSource,
  type SyncLog,
  type SyncResult,
} from "../../../../hooks/use-calendar-sync";
import { useProperties } from "../../../../hooks/use-properties";
import { Card } from "../../../../components/ui/Card";
import { Button } from "../../../../components/ui/Button";

const INTERVAL_OPTIONS = [
  { value: 15, label: "15 min" },
  { value: 30, label: "30 min" },
  { value: 60, label: "1 hour" },
  { value: 240, label: "4 hours" },
  { value: 1440, label: "Daily" },
  { value: 0, label: "Manual only" },
] as const;

function fmtTimestamp(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function fmtDuration(ms: number | null | undefined): string {
  if (!ms) return "";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export default function CalendarSourceDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const sourceQuery = useCalendarSource(id);
  const source = sourceQuery.data;
  const syncLogs: SyncLog[] = (source as any)?.syncLogs ?? [];

  const updateSource = useUpdateCalendarSource();
  const deleteSource = useDeleteCalendarSource();
  const syncSource = useSyncSource();

  const propertiesQuery = useProperties({ status: "active" });
  const properties = propertiesQuery.data ?? [];

  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [propertyId, setPropertyId] = useState<string | null>(null);
  const [syncIntervalMinutes, setSyncIntervalMinutes] = useState(60);
  const [isActive, setIsActive] = useState(true);
  const [showPropertyPicker, setShowPropertyPicker] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  useEffect(() => {
    if (source) {
      setName(source.name);
      setUrl(source.url);
      setPropertyId(source.propertyId ?? null);
      setSyncIntervalMinutes(source.syncIntervalMinutes);
      setIsActive(source.isActive);
    }
  }, [source]);

  const selectedProperty = properties.find((p) => p.id === propertyId);

  const handleSave = () => {
    if (!id || !name.trim() || !url.trim()) {
      Alert.alert("Missing Fields", "Name and URL are required.");
      return;
    }
    updateSource.mutate(
      { id, name: name.trim(), url: url.trim(), propertyId, syncIntervalMinutes, isActive },
      {
        onSuccess: () => Alert.alert("Saved", "Calendar source updated."),
        onError: (err: any) =>
          Alert.alert("Error", err?.message ?? "Failed to update."),
      }
    );
  };

  const handleSync = () => {
    if (!id) return;
    setSyncResult(null);
    syncSource.mutate(id, {
      onSuccess: (result) => {
        setSyncResult(result);
        sourceQuery.refetch();
      },
      onError: (err: any) =>
        Alert.alert("Sync Failed", err?.message ?? "Sync encountered an error."),
    });
  };

  const handleDelete = () => {
    if (!id) return;
    Alert.alert(
      "Delete Source",
      "This will not delete imported jobs. Are you sure you want to remove this calendar source?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () =>
            deleteSource.mutate(id, {
              onSuccess: () => router.back(),
              onError: (err: any) =>
                Alert.alert("Error", err?.message ?? "Failed to delete."),
            }),
        },
      ]
    );
  };

  if (sourceQuery.isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Source Details</Text>

        {/* Editable Fields */}
        <Card style={styles.section}>
          <Text style={styles.fieldLabel}>Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholderTextColor="#9ca3af"
          />

          <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Feed URL</Text>
          <TextInput
            style={styles.input}
            value={url}
            onChangeText={setUrl}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            placeholderTextColor="#9ca3af"
          />

          <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Property</Text>
          <TouchableOpacity
            style={styles.pickerButton}
            onPress={() => setShowPropertyPicker(!showPropertyPicker)}
          >
            <Text style={styles.pickerButtonText}>
              {propertyId === null
                ? "Multi-property"
                : selectedProperty?.name ?? "Select..."}
            </Text>
            <Text style={styles.pickerChevron}>
              {showPropertyPicker ? "\u25B2" : "\u25BC"}
            </Text>
          </TouchableOpacity>
          {showPropertyPicker && (
            <View style={styles.pickerList}>
              <TouchableOpacity
                style={[styles.pickerOption, propertyId === null && styles.pickerOptionActive]}
                onPress={() => { setPropertyId(null); setShowPropertyPicker(false); }}
              >
                <Text style={[styles.pickerOptionText, propertyId === null && styles.pickerOptionTextActive]}>
                  Multi-property
                </Text>
              </TouchableOpacity>
              {properties.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.pickerOption, propertyId === p.id && styles.pickerOptionActive]}
                  onPress={() => { setPropertyId(p.id); setShowPropertyPicker(false); }}
                >
                  <Text style={[styles.pickerOptionText, propertyId === p.id && styles.pickerOptionTextActive]}>
                    {p.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Auto-sync Interval</Text>
          <View style={styles.pillRow}>
            {INTERVAL_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.pill, syncIntervalMinutes === opt.value && styles.pillActive]}
                onPress={() => setSyncIntervalMinutes(opt.value)}
              >
                <Text style={[styles.pillText, syncIntervalMinutes === opt.value && styles.pillTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={[styles.toggleRow, { marginTop: 16 }]}>
            <View>
              <Text style={styles.toggleLabel}>Active</Text>
              <Text style={styles.toggleHint}>Enable auto-sync</Text>
            </View>
            <Switch
              value={isActive}
              onValueChange={setIsActive}
              trackColor={{ false: "#d1d5db", true: "#93c5fd" }}
              thumbColor={isActive ? "#2563eb" : "#f3f4f6"}
            />
          </View>
        </Card>

        {/* Save button */}
        <Button
          onPress={handleSave}
          variant="primary"
          size="lg"
          fullWidth
          loading={updateSource.isPending}
          style={{ marginBottom: 16 }}
        >
          Save Changes
        </Button>

        {/* Sync Now */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Manual Sync</Text>
          <Button
            onPress={handleSync}
            variant="outline"
            size="md"
            fullWidth
            loading={syncSource.isPending}
          >
            Sync Now
          </Button>
          {syncResult && (
            <View style={styles.syncResultBox}>
              <Text style={styles.syncResultText}>
                Created {syncResult.eventsCreated}, Updated{" "}
                {syncResult.eventsUpdated}, Skipped {syncResult.eventsSkipped},
                Errors {syncResult.errors?.length ?? 0}
              </Text>
            </View>
          )}
        </Card>

        {/* Sync History */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Sync History</Text>
          {syncLogs.length === 0 ? (
            <Text style={styles.emptyText}>No sync history yet.</Text>
          ) : (
            syncLogs.slice(0, 20).map((log) => {
              const isExpanded = expandedLogId === log.id;
              const statusColor =
                log.status === "success"
                  ? "#16a34a"
                  : log.status === "error"
                  ? "#dc2626"
                  : "#ca8a04";
              const errorCount = log.errors?.length ?? 0;

              return (
                <TouchableOpacity
                  key={log.id}
                  style={styles.logCard}
                  onPress={() =>
                    setExpandedLogId(isExpanded ? null : log.id)
                  }
                  activeOpacity={0.7}
                >
                  <View style={styles.logTopRow}>
                    <View style={styles.logStatusBadge}>
                      <View
                        style={[
                          styles.logDot,
                          { backgroundColor: statusColor },
                        ]}
                      />
                      <Text style={[styles.logStatusText, { color: statusColor }]}>
                        {log.status}
                      </Text>
                    </View>
                    <Text style={styles.logTimestamp}>
                      {fmtTimestamp(log.startedAt)}
                    </Text>
                  </View>
                  <Text style={styles.logStats}>
                    Processed {log.eventsProcessed} | +{log.eventsCreated} |{" "}
                    ~{log.eventsUpdated} | ={log.eventsSkipped}
                    {errorCount > 0 ? ` | ${errorCount} err` : ""}
                    {log.durationMs ? ` | ${fmtDuration(log.durationMs)}` : ""}
                  </Text>
                  {isExpanded && errorCount > 0 && (
                    <View style={styles.errorList}>
                      {log.errors!.map((e, i) => (
                        <View key={i} style={styles.errorItem}>
                          <Text style={styles.errorTitle} numberOfLines={1}>
                            {e.eventTitle}
                          </Text>
                          <Text style={styles.errorReason}>{e.reason}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                  {isExpanded && errorCount === 0 && (
                    <Text style={styles.noErrors}>No errors in this sync.</Text>
                  )}
                </TouchableOpacity>
              );
            })
          )}
        </Card>

        {/* Delete */}
        <View style={styles.dangerZone}>
          <Button
            onPress={handleDelete}
            variant="danger"
            size="md"
            fullWidth
            loading={deleteSource.isPending}
          >
            Delete Source
          </Button>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  centered: { alignItems: "center", justifyContent: "center" },
  content: { padding: 16 },
  title: { fontSize: 22, fontWeight: "700", color: "#111827", marginBottom: 16 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: "600", color: "#111827", marginBottom: 12 },
  fieldLabel: { fontSize: 13, fontWeight: "500", color: "#374151", marginBottom: 6 },
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
  syncResultBox: {
    marginTop: 12,
    backgroundColor: "#f0fdf4",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },
  syncResultText: { fontSize: 14, fontWeight: "600", color: "#166534" },
  emptyText: { fontSize: 13, color: "#9ca3af", fontStyle: "italic" },
  logCard: {
    backgroundColor: "#f9fafb",
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: "#f3f4f6",
  },
  logTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  logStatusBadge: { flexDirection: "row", alignItems: "center", gap: 4 },
  logDot: { width: 6, height: 6, borderRadius: 3 },
  logStatusText: { fontSize: 12, fontWeight: "600", textTransform: "capitalize" },
  logTimestamp: { fontSize: 11, color: "#9ca3af" },
  logStats: { fontSize: 12, color: "#6b7280" },
  errorList: { marginTop: 8, borderTopWidth: 1, borderTopColor: "#e5e7eb", paddingTop: 8 },
  errorItem: { marginBottom: 6 },
  errorTitle: { fontSize: 12, fontWeight: "600", color: "#dc2626" },
  errorReason: { fontSize: 11, color: "#9ca3af" },
  noErrors: { fontSize: 12, color: "#16a34a", marginTop: 8, fontStyle: "italic" },
  dangerZone: { marginTop: 8, marginBottom: 32 },
});
