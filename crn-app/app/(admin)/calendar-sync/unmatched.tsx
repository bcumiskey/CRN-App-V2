import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useState } from "react";
import {
  useUnmatchedEvents,
  useAssignUnmatchedEvent,
  useDismissUnmatchedEvent,
} from "../../../hooks/use-calendar-sync";
import { useProperties } from "../../../hooks/use-properties";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { EmptyState } from "../../../components/ui/EmptyState";

export default function UnmatchedEventsScreen() {
  const unmatchedQuery = useUnmatchedEvents();
  const events = unmatchedQuery.data ?? [];
  const assignEvent = useAssignUnmatchedEvent();
  const dismissEvent = useDismissUnmatchedEvent();
  const propertiesQuery = useProperties({ status: "active" });
  const properties = propertiesQuery.data ?? [];

  const [assigningId, setAssigningId] = useState<string | null>(null);

  const handleAssign = (eventId: string, propertyId: string) => {
    assignEvent.mutate(
      { id: eventId, propertyId },
      {
        onSuccess: () => setAssigningId(null),
        onError: (err: any) =>
          Alert.alert("Error", err?.message ?? "Failed to assign event."),
      }
    );
  };

  const handleDismiss = (eventId: string) => {
    Alert.alert(
      "Dismiss Event",
      "This event will be marked as dismissed and won't appear again.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Dismiss",
          onPress: () =>
            dismissEvent.mutate(eventId, {
              onError: (err: any) =>
                Alert.alert("Error", err?.message ?? "Failed to dismiss."),
            }),
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={events}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={unmatchedQuery.isRefetching}
            onRefresh={() => unmatchedQuery.refetch()}
          />
        }
        ListHeaderComponent={
          events.length > 0 ? (
            <Text style={styles.headerText}>
              {events.length} unmatched event{events.length !== 1 ? "s" : ""}{" "}
              need review
            </Text>
          ) : null
        }
        renderItem={({ item }) => {
          const isAssigning = assigningId === item.id;

          return (
            <Card style={styles.eventCard}>
              <Text style={styles.eventTitle} numberOfLines={2}>
                {item.rawSummary}
              </Text>
              <Text style={styles.eventDate}>{item.date}</Text>

              {isAssigning ? (
                <View style={styles.propertyPicker}>
                  <Text style={styles.pickerLabel}>Assign to property:</Text>
                  {propertiesQuery.isLoading ? (
                    <ActivityIndicator
                      size="small"
                      color="#2563eb"
                      style={{ marginVertical: 8 }}
                    />
                  ) : (
                    properties.map((p) => (
                      <TouchableOpacity
                        key={p.id}
                        style={styles.propertyOption}
                        onPress={() => handleAssign(item.id, p.id)}
                      >
                        <Text style={styles.propertyOptionText}>{p.name}</Text>
                      </TouchableOpacity>
                    ))
                  )}
                  <TouchableOpacity
                    style={styles.cancelPicker}
                    onPress={() => setAssigningId(null)}
                  >
                    <Text style={styles.cancelPickerText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.actionRow}>
                  <Button
                    onPress={() => setAssigningId(item.id)}
                    variant="primary"
                    size="sm"
                    loading={assignEvent.isPending && assigningId === item.id}
                  >
                    Assign
                  </Button>
                  <Button
                    onPress={() => handleDismiss(item.id)}
                    variant="ghost"
                    size="sm"
                    loading={dismissEvent.isPending}
                  >
                    Dismiss
                  </Button>
                </View>
              )}
            </Card>
          );
        }}
        ListEmptyComponent={
          unmatchedQuery.isLoading ? (
            <ActivityIndicator
              size="large"
              color="#2563eb"
              style={{ marginTop: 48 }}
            />
          ) : (
            <EmptyState
              title="No unmatched events"
              message="All calendar events matched successfully."
            />
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  list: { padding: 16 },
  headerText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#92400e",
    backgroundColor: "#fef3c7",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 12,
    overflow: "hidden",
  },
  eventCard: { marginBottom: 10 },
  eventTitle: { fontSize: 15, fontWeight: "600", color: "#111827", marginBottom: 4 },
  eventDate: { fontSize: 13, color: "#6b7280", marginBottom: 10 },
  actionRow: {
    flexDirection: "row",
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
    paddingTop: 10,
  },
  propertyPicker: {
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
    paddingTop: 10,
  },
  pickerLabel: { fontSize: 13, fontWeight: "500", color: "#374151", marginBottom: 8 },
  propertyOption: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
    borderRadius: 6,
  },
  propertyOptionText: { fontSize: 14, color: "#2563eb", fontWeight: "500" },
  cancelPicker: { paddingVertical: 10, alignItems: "center" },
  cancelPickerText: { fontSize: 13, color: "#9ca3af" },
});
