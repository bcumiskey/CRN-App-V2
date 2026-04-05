import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import {
  useStandingInstructions,
  useCreateInstruction,
  useUpdateInstruction,
  StandingInstruction,
} from "../../../../../hooks/use-property-profile";
import { Card } from "../../../../../components/ui/Card";
import { Button } from "../../../../../components/ui/Button";
import { EmptyState } from "../../../../../components/ui/EmptyState";

type Priority = "critical" | "important" | "general" | "seasonal";

const PRIORITY_CONFIG: Record<
  Priority,
  { icon: string; label: string; color: string; bg: string }
> = {
  critical: { icon: "\uD83D\uDD34", label: "Critical", color: "#dc2626", bg: "#fef2f2" },
  important: { icon: "\uD83D\uDFE1", label: "Important", color: "#ca8a04", bg: "#fefce8" },
  general: { icon: "\u26AA", label: "General", color: "#6b7280", bg: "#f9fafb" },
  seasonal: { icon: "\uD83D\uDD50", label: "Seasonal", color: "#2563eb", bg: "#eff6ff" },
};

const CATEGORIES = [
  "Cleaning",
  "Supplies",
  "Access",
  "Guest Communication",
  "Maintenance",
  "Laundry",
  "Trash",
  "Other",
];

interface InstructionForm {
  text: string;
  category: string;
  priority: Priority;
  seasonalStart: string;
  seasonalEnd: string;
}

const EMPTY_FORM: InstructionForm = {
  text: "",
  category: "Cleaning",
  priority: "general",
  seasonalStart: "",
  seasonalEnd: "",
};

export default function StandingInstructionsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const instructionsQuery = useStandingInstructions(id);
  const createInstruction = useCreateInstruction();
  const updateInstruction = useUpdateInstruction();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<InstructionForm>(EMPTY_FORM);

  const instructions = instructionsQuery.data ?? [];

  // Group by priority
  const grouped: Record<Priority, StandingInstruction[]> = {
    critical: [],
    important: [],
    general: [],
    seasonal: [],
  };
  for (const inst of instructions) {
    const p = inst.priority as Priority;
    if (grouped[p]) grouped[p].push(inst);
    else grouped.general.push(inst);
  }

  function openAddForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function openEditForm(inst: StandingInstruction) {
    setEditingId(inst.id);
    setForm({
      text: inst.text,
      category: inst.category,
      priority: inst.priority,
      seasonalStart: inst.seasonalStart ?? "",
      seasonalEnd: inst.seasonalEnd ?? "",
    });
    setShowForm(true);
  }

  function handleSave() {
    if (!id) return;
    if (!form.text.trim()) {
      Alert.alert("Required", "Instruction text is required.");
      return;
    }

    const payload = {
      text: form.text.trim(),
      category: form.category,
      priority: form.priority,
      seasonalStart: form.seasonalStart || undefined,
      seasonalEnd: form.seasonalEnd || undefined,
    };

    if (editingId) {
      updateInstruction.mutate(
        { propertyId: id, instructionId: editingId, ...payload },
        {
          onSuccess: () => setShowForm(false),
          onError: () => Alert.alert("Error", "Failed to update instruction."),
        }
      );
    } else {
      createInstruction.mutate(
        { propertyId: id, ...payload },
        {
          onSuccess: () => setShowForm(false),
          onError: () => Alert.alert("Error", "Failed to create instruction."),
        }
      );
    }
  }

  function handleDelete(inst: StandingInstruction) {
    if (!id) return;
    Alert.alert("Remove Instruction", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () =>
          updateInstruction.mutate({
            propertyId: id,
            instructionId: inst.id,
            isActive: false,
          }),
      },
    ]);
  }

  if (instructionsQuery.isLoading) {
    return (
      <View style={styles.loading}>
        <Text>Loading...</Text>
      </View>
    );
  }

  const priorityOrder: Priority[] = ["critical", "important", "general", "seasonal"];

  return (
    <View style={styles.container}>
      {instructions.length === 0 && !showForm ? (
        <EmptyState
          title="No Standing Instructions"
          message="Add instructions that apply to every clean at this property."
          actionLabel="+ Add Instruction"
          onAction={openAddForm}
        />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {priorityOrder.map((priority) => {
            const group = grouped[priority].filter((i) => i.isActive);
            if (group.length === 0) return null;
            const config = PRIORITY_CONFIG[priority];

            return (
              <View key={priority} style={styles.groupSection}>
                <View style={styles.groupHeader}>
                  <Text style={styles.groupIcon}>{config.icon}</Text>
                  <Text style={[styles.groupLabel, { color: config.color }]}>
                    {config.label}
                  </Text>
                </View>

                {group.map((inst) => (
                  <TouchableOpacity
                    key={inst.id}
                    onPress={() => openEditForm(inst)}
                    activeOpacity={0.7}
                  >
                    <Card style={[styles.instructionCard, { borderLeftColor: config.color }]}>
                      <View style={styles.instructionRow}>
                        <View style={styles.instructionContent}>
                          <Text style={styles.instructionText}>{inst.text}</Text>
                          <View style={styles.badges}>
                            <View style={[styles.categoryBadge, { backgroundColor: config.bg }]}>
                              <Text style={[styles.categoryBadgeText, { color: config.color }]}>
                                {inst.category}
                              </Text>
                            </View>
                            {inst.seasonalStart && inst.seasonalEnd && (
                              <Text style={styles.seasonalRange}>
                                {inst.seasonalStart} - {inst.seasonalEnd}
                              </Text>
                            )}
                          </View>
                        </View>
                        <TouchableOpacity
                          onPress={() => handleDelete(inst)}
                          style={styles.xBtn}
                        >
                          <Text style={styles.xBtnText}>X</Text>
                        </TouchableOpacity>
                      </View>
                    </Card>
                  </TouchableOpacity>
                ))}
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Add Button */}
      <View style={styles.addBar}>
        <Button onPress={openAddForm} variant="primary" fullWidth>
          + Add Instruction
        </Button>
      </View>

      {/* Add/Edit Modal */}
      <Modal
        visible={showForm}
        animationType="slide"
        transparent
        onRequestClose={() => setShowForm(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingId ? "Edit Instruction" : "New Instruction"}
              </Text>
              <TouchableOpacity onPress={() => setShowForm(false)}>
                <Text style={styles.modalCancel}>Cancel</Text>
              </TouchableOpacity>
            </View>

            <ScrollView>
              {/* Text */}
              <Text style={styles.formLabel}>Instruction</Text>
              <TextInput
                style={styles.textArea}
                value={form.text}
                onChangeText={(text) => setForm((f) => ({ ...f, text }))}
                placeholder="e.g. Always check under beds for guest items"
                placeholderTextColor="#9ca3af"
                multiline
                numberOfLines={3}
              />

              {/* Category */}
              <Text style={styles.formLabel}>Category</Text>
              <View style={styles.pillRow}>
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    onPress={() => setForm((f) => ({ ...f, category: cat }))}
                    style={[
                      styles.catPill,
                      form.category === cat && styles.catPillActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.catPillText,
                        form.category === cat && styles.catPillTextActive,
                      ]}
                    >
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Priority */}
              <Text style={styles.formLabel}>Priority</Text>
              <View style={styles.pillRow}>
                {priorityOrder.map((p) => {
                  const config = PRIORITY_CONFIG[p];
                  return (
                    <TouchableOpacity
                      key={p}
                      onPress={() => setForm((f) => ({ ...f, priority: p }))}
                      style={[
                        styles.priorityPill,
                        form.priority === p && {
                          backgroundColor: config.bg,
                          borderColor: config.color,
                        },
                      ]}
                    >
                      <Text style={styles.priorityIcon}>{config.icon}</Text>
                      <Text
                        style={[
                          styles.priorityText,
                          form.priority === p && { color: config.color },
                        ]}
                      >
                        {config.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Seasonal Dates (shown when priority is seasonal) */}
              {form.priority === "seasonal" && (
                <View style={styles.seasonalFields}>
                  <Text style={styles.formLabel}>
                    Seasonal Date Range (e.g. 05-01 to 09-30)
                  </Text>
                  <View style={styles.dateRow}>
                    <TextInput
                      style={styles.dateInput}
                      value={form.seasonalStart}
                      onChangeText={(seasonalStart) =>
                        setForm((f) => ({ ...f, seasonalStart }))
                      }
                      placeholder="MM-DD"
                      placeholderTextColor="#9ca3af"
                    />
                    <Text style={styles.dateTo}>to</Text>
                    <TextInput
                      style={styles.dateInput}
                      value={form.seasonalEnd}
                      onChangeText={(seasonalEnd) =>
                        setForm((f) => ({ ...f, seasonalEnd }))
                      }
                      placeholder="MM-DD"
                      placeholderTextColor="#9ca3af"
                    />
                  </View>
                </View>
              )}

              <View style={{ marginTop: 20 }}>
                <Button
                  onPress={handleSave}
                  variant="primary"
                  fullWidth
                  loading={
                    createInstruction.isPending || updateInstruction.isPending
                  }
                >
                  {editingId ? "Update" : "Add Instruction"}
                </Button>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  loading: { flex: 1, justifyContent: "center", alignItems: "center" },
  content: { padding: 16, paddingBottom: 100 },
  groupSection: { marginBottom: 20 },
  groupHeader: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  groupIcon: { fontSize: 16, marginRight: 6 },
  groupLabel: { fontSize: 14, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  instructionCard: { marginBottom: 8, borderLeftWidth: 3 },
  instructionRow: { flexDirection: "row", alignItems: "flex-start" },
  instructionContent: { flex: 1 },
  instructionText: { fontSize: 14, color: "#111827", lineHeight: 20 },
  badges: { flexDirection: "row", alignItems: "center", marginTop: 6, gap: 8 },
  categoryBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  categoryBadgeText: { fontSize: 11, fontWeight: "600" },
  seasonalRange: { fontSize: 12, color: "#6b7280" },
  xBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#fef2f2",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  xBtnText: { color: "#dc2626", fontWeight: "600", fontSize: 11 },
  addBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalSheet: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: "80%",
    padding: 16,
  },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#111827" },
  modalCancel: { fontSize: 15, color: "#2563eb", fontWeight: "500" },
  formLabel: { fontSize: 12, fontWeight: "600", color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 12, marginBottom: 6 },
  textArea: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: "#111827",
    minHeight: 72,
    textAlignVertical: "top",
  },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  catPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#f3f4f6",
  },
  catPillActive: { backgroundColor: "#2563eb" },
  catPillText: { fontSize: 13, color: "#6b7280", fontWeight: "500" },
  catPillTextActive: { color: "#ffffff" },
  priorityPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#f3f4f6",
    borderWidth: 1,
    borderColor: "transparent",
    gap: 4,
  },
  priorityIcon: { fontSize: 12 },
  priorityText: { fontSize: 13, color: "#6b7280", fontWeight: "500" },
  seasonalFields: { marginTop: 4 },
  dateRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  dateInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: "#111827",
  },
  dateTo: { fontSize: 13, color: "#6b7280" },
});
