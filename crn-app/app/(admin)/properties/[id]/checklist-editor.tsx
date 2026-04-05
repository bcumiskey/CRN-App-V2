import { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Switch,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  usePropertyChecklists,
  useUpdateChecklist,
  useCopyChecklist,
  ChecklistItem,
} from "../../../../hooks/use-property-profile";
import { useProperties } from "../../../../hooks/use-properties";
import { Card } from "../../../../components/ui/Card";
import { Button } from "../../../../components/ui/Button";

interface EditableItem {
  id?: string;
  text: string;
  roomGroup: string;
  isRequired: boolean;
  sortOrder: number;
  isNew?: boolean;
}

const JOB_TYPES = ["All Types", "STANDARD", "DEEP_CLEAN", "TURNOVER", "INSPECTION", "LAUNDRY"];

export default function ChecklistEditorScreen() {
  const { id, checklistId } = useLocalSearchParams<{
    id: string;
    checklistId: string;
  }>();
  const router = useRouter();
  const checklistsQuery = usePropertyChecklists(id);
  const updateChecklist = useUpdateChecklist();
  const copyChecklist = useCopyChecklist();
  const propertiesQuery = useProperties({ status: "active" });

  const checklist = checklistsQuery.data?.find((c) => c.id === checklistId);

  const [name, setName] = useState("");
  const [jobTypeScope, setJobTypeScope] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(true);
  const [items, setItems] = useState<EditableItem[]>([]);
  const [showPropertyPicker, setShowPropertyPicker] = useState(false);

  // Initialize form state from fetched checklist
  useEffect(() => {
    if (checklist) {
      setName(checklist.name);
      setJobTypeScope(checklist.jobTypeScope);
      setIsActive(checklist.isActive);
      setItems(
        checklist.items.map((item) => ({
          id: item.id,
          text: item.text,
          roomGroup: item.roomGroup ?? "",
          isRequired: item.isRequired,
          sortOrder: item.sortOrder,
        }))
      );
    }
  }, [checklist?.id]);

  function addItem() {
    setItems((prev) => [
      ...prev,
      {
        text: "",
        roomGroup: "",
        isRequired: false,
        sortOrder: prev.length,
        isNew: true,
      },
    ]);
  }

  function updateItem(index: number, updates: Partial<EditableItem>) {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...updates } : item))
    );
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSave() {
    if (!id || !checklistId) return;
    const filteredItems = items
      .filter((item) => item.text.trim() !== "")
      .map((item, i) => ({
        id: item.isNew ? undefined : item.id,
        text: item.text.trim(),
        roomGroup: item.roomGroup.trim() || null,
        isRequired: item.isRequired,
        sortOrder: i,
      }));

    updateChecklist.mutate(
      {
        propertyId: id,
        checklistId,
        name: name.trim(),
        jobTypeScope: jobTypeScope === "All Types" ? null : jobTypeScope,
        isActive,
        items: filteredItems,
      },
      {
        onSuccess: () => {
          router.back();
        },
        onError: () => {
          Alert.alert("Error", "Failed to save checklist.");
        },
      }
    );
  }

  function handleCopy(targetPropertyId: string) {
    if (!id || !checklistId) return;
    setShowPropertyPicker(false);
    copyChecklist.mutate(
      { propertyId: id, checklistId, targetPropertyId },
      {
        onSuccess: () => {
          Alert.alert("Copied", "Checklist copied to the selected property.");
        },
        onError: () => {
          Alert.alert("Error", "Failed to copy checklist.");
        },
      }
    );
  }

  if (!checklist && checklistsQuery.isLoading) {
    return (
      <View style={styles.loading}>
        <Text>Loading...</Text>
      </View>
    );
  }

  const otherProperties = (propertiesQuery.data ?? []).filter(
    (p) => p.id !== id
  );

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Checklist Header */}
        <Card style={styles.headerCard}>
          <Text style={styles.fieldLabel}>Checklist Name</Text>
          <TextInput
            style={styles.nameInput}
            value={name}
            onChangeText={setName}
            placeholder="Checklist name"
            placeholderTextColor="#9ca3af"
          />

          <Text style={[styles.fieldLabel, { marginTop: 12 }]}>
            Job Type Scope
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.scopeScroll}
          >
            {JOB_TYPES.map((jt) => {
              const isSelected =
                jt === "All Types" ? !jobTypeScope : jobTypeScope === jt;
              return (
                <TouchableOpacity
                  key={jt}
                  onPress={() =>
                    setJobTypeScope(jt === "All Types" ? null : jt)
                  }
                  style={[styles.scopePill, isSelected && styles.scopePillActive]}
                >
                  <Text
                    style={[
                      styles.scopePillText,
                      isSelected && styles.scopePillTextActive,
                    ]}
                  >
                    {jt}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={styles.activeRow}>
            <Text style={styles.fieldLabel}>Active</Text>
            <Switch
              value={isActive}
              onValueChange={setIsActive}
              trackColor={{ false: "#d1d5db", true: "#93c5fd" }}
              thumbColor={isActive ? "#2563eb" : "#f4f4f5"}
            />
          </View>
        </Card>

        {/* Items */}
        <Text style={styles.sectionTitle}>
          Items ({items.length})
        </Text>

        {items.map((item, index) => (
          <Card key={item.id ?? `new-${index}`} style={styles.itemCard}>
            <View style={styles.itemHeader}>
              <TextInput
                style={styles.itemTextInput}
                value={item.text}
                onChangeText={(text) => updateItem(index, { text })}
                placeholder="Checklist item..."
                placeholderTextColor="#9ca3af"
                multiline
              />
              <TouchableOpacity
                onPress={() => removeItem(index)}
                style={styles.deleteBtn}
              >
                <Text style={styles.deleteBtnText}>X</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.itemMeta}>
              <View style={styles.roomGroupField}>
                <Text style={styles.itemFieldLabel}>Room</Text>
                <TextInput
                  style={styles.roomGroupInput}
                  value={item.roomGroup}
                  onChangeText={(roomGroup) =>
                    updateItem(index, { roomGroup })
                  }
                  placeholder="e.g. Kitchen"
                  placeholderTextColor="#9ca3af"
                />
              </View>
              <View style={styles.requiredField}>
                <Text style={styles.itemFieldLabel}>Required</Text>
                <Switch
                  value={item.isRequired}
                  onValueChange={(isRequired) =>
                    updateItem(index, { isRequired })
                  }
                  trackColor={{ false: "#d1d5db", true: "#93c5fd" }}
                  thumbColor={item.isRequired ? "#2563eb" : "#f4f4f5"}
                />
              </View>
            </View>
          </Card>
        ))}

        <Button onPress={addItem} variant="outline" fullWidth>
          + Add Item
        </Button>

        {/* Copy to Another Property */}
        <View style={styles.copySection}>
          <Button
            onPress={() => setShowPropertyPicker(true)}
            variant="ghost"
            loading={copyChecklist.isPending}
          >
            Copy to Another Property
          </Button>
        </View>

        {/* Property Picker inline */}
        {showPropertyPicker && (
          <Card style={styles.propertyPickerCard}>
            <Text style={styles.pickerTitle}>Select Target Property</Text>
            {otherProperties.length === 0 ? (
              <Text style={styles.noProps}>No other active properties.</Text>
            ) : (
              otherProperties.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  onPress={() => handleCopy(p.id)}
                  style={styles.propertyRow}
                >
                  <Text style={styles.propertyName}>{p.name}</Text>
                  <Text style={styles.propertyCode}>{p.code}</Text>
                </TouchableOpacity>
              ))
            )}
            <Button
              onPress={() => setShowPropertyPicker(false)}
              variant="ghost"
              size="sm"
            >
              Cancel
            </Button>
          </Card>
        )}
      </ScrollView>

      {/* Save Button */}
      <View style={styles.saveBar}>
        <Button
          onPress={handleSave}
          variant="primary"
          fullWidth
          loading={updateChecklist.isPending}
        >
          Save Checklist
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  loading: { flex: 1, justifyContent: "center", alignItems: "center" },
  content: { padding: 16, paddingBottom: 100 },
  headerCard: { marginBottom: 16 },
  fieldLabel: { fontSize: 12, fontWeight: "600", color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 },
  nameInput: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    paddingVertical: 8,
  },
  scopeScroll: { marginTop: 4 },
  scopePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#f3f4f6",
    marginRight: 8,
  },
  scopePillActive: { backgroundColor: "#2563eb" },
  scopePillText: { fontSize: 13, color: "#6b7280", fontWeight: "500" },
  scopePillTextActive: { color: "#ffffff" },
  activeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6b7280",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  itemCard: { marginBottom: 8 },
  itemHeader: { flexDirection: "row", alignItems: "flex-start" },
  itemTextInput: {
    flex: 1,
    fontSize: 14,
    color: "#111827",
    minHeight: 36,
    paddingVertical: 4,
  },
  deleteBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#fef2f2",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  deleteBtnText: { color: "#dc2626", fontWeight: "600", fontSize: 12 },
  itemMeta: { flexDirection: "row", marginTop: 8, gap: 12 },
  roomGroupField: { flex: 1 },
  itemFieldLabel: { fontSize: 11, color: "#9ca3af", marginBottom: 2 },
  roomGroupInput: {
    fontSize: 13,
    color: "#374151",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  requiredField: { alignItems: "center" },
  copySection: { marginTop: 24, alignItems: "center" },
  propertyPickerCard: { marginTop: 8 },
  pickerTitle: { fontSize: 14, fontWeight: "600", color: "#111827", marginBottom: 8 },
  noProps: { fontSize: 13, color: "#9ca3af", paddingVertical: 12 },
  propertyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  propertyName: { fontSize: 14, fontWeight: "500", color: "#111827" },
  propertyCode: { fontSize: 12, color: "#9ca3af" },
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
