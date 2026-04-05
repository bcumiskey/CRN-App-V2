import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Modal,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  usePropertyChecklists,
  useCreateChecklist,
  useChecklistTemplates,
  ChecklistWithItems,
  ChecklistTemplate,
} from "../../../../../hooks/use-property-profile";
import { Card } from "../../../../../components/ui/Card";
import { Button } from "../../../../../components/ui/Button";
import { EmptyState } from "../../../../../components/ui/EmptyState";

export default function ChecklistsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const checklistsQuery = usePropertyChecklists(id);
  const templatesQuery = useChecklistTemplates();
  const createChecklist = useCreateChecklist();

  const [showTemplatePicker, setShowTemplatePicker] = useState(false);

  const checklists = checklistsQuery.data ?? [];
  const templates = templatesQuery.data ?? [];

  function handleNewChecklist() {
    if (!id) return;
    createChecklist.mutate(
      { propertyId: id, name: "New Checklist", items: [] },
      {
        onSuccess: (data) => {
          router.push(
            `/(admin)/(more)/properties/${id}/checklist-editor?checklistId=${data.id}`
          );
        },
        onError: () => {
          Alert.alert("Error", "Failed to create checklist.");
        },
      }
    );
  }

  function handlePickTemplate(template: ChecklistTemplate) {
    if (!id) return;
    setShowTemplatePicker(false);
    createChecklist.mutate(
      {
        propertyId: id,
        name: template.name,
        items: template.items.map((item, i) => ({
          text: item.text,
          roomGroup: item.roomGroup ?? undefined,
          isRequired: item.isRequired,
          sortOrder: i,
        })),
      },
      {
        onSuccess: (data) => {
          router.push(
            `/(admin)/(more)/properties/${id}/checklist-editor?checklistId=${data.id}`
          );
        },
        onError: () => {
          Alert.alert("Error", "Failed to create checklist from template.");
        },
      }
    );
  }

  function openEditor(checklist: ChecklistWithItems) {
    router.push(
      `/(admin)/(more)/properties/${id}/checklist-editor?checklistId=${checklist.id}`
    );
  }

  if (checklistsQuery.isLoading) {
    return (
      <View style={styles.loading}>
        <Text>Loading checklists...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {checklists.length === 0 ? (
        <EmptyState
          title="No Checklists"
          message="Create checklists to standardize cleaning tasks for this property."
          actionLabel="+ New Checklist"
          onAction={handleNewChecklist}
        />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {checklists.map((cl) => (
            <TouchableOpacity
              key={cl.id}
              onPress={() => openEditor(cl)}
              activeOpacity={0.7}
            >
              <Card style={styles.checklistCard}>
                <View style={styles.checklistHeader}>
                  <View style={styles.checklistInfo}>
                    <Text style={styles.checklistName}>{cl.name}</Text>
                    <Text style={styles.checklistMeta}>
                      {cl.jobTypeScope ?? "All Types"} {"\u2022"}{" "}
                      {cl.items.length} item{cl.items.length !== 1 ? "s" : ""}
                    </Text>
                  </View>
                  <View style={styles.activeToggle}>
                    <Text style={styles.activeLabel}>
                      {cl.isActive ? "Active" : "Inactive"}
                    </Text>
                    <View
                      style={[
                        styles.statusDot,
                        { backgroundColor: cl.isActive ? "#16a34a" : "#9ca3af" },
                      ]}
                    />
                  </View>
                </View>
                <Text style={styles.tapHint}>Tap to edit</Text>
              </Card>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Bottom Actions */}
      <View style={styles.bottomActions}>
        <Button
          onPress={handleNewChecklist}
          variant="primary"
          loading={createChecklist.isPending}
          style={styles.actionBtn}
        >
          + New Checklist
        </Button>
        <Button
          onPress={() => setShowTemplatePicker(true)}
          variant="outline"
          style={styles.actionBtn}
        >
          Add from Template
        </Button>
      </View>

      {/* Template Picker Modal */}
      <Modal
        visible={showTemplatePicker}
        animationType="slide"
        transparent
        onRequestClose={() => setShowTemplatePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choose a Template</Text>
              <TouchableOpacity onPress={() => setShowTemplatePicker(false)}>
                <Text style={styles.modalCloseText}>Cancel</Text>
              </TouchableOpacity>
            </View>

            {templates.length === 0 ? (
              <Text style={styles.noTemplates}>No templates available.</Text>
            ) : (
              <ScrollView>
                {templates.map((t) => (
                  <TouchableOpacity
                    key={t.id}
                    onPress={() => handlePickTemplate(t)}
                    style={styles.templateItem}
                    activeOpacity={0.7}
                  >
                    <View style={styles.templateBadge}>
                      <Text style={styles.templateBadgeText}>
                        {t.category}
                      </Text>
                    </View>
                    <Text style={styles.templateName}>{t.name}</Text>
                    {t.description && (
                      <Text style={styles.templateDesc}>{t.description}</Text>
                    )}
                    <Text style={styles.templateItemCount}>
                      {t.items.length} items
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  loading: { flex: 1, justifyContent: "center", alignItems: "center" },
  content: { padding: 16, paddingBottom: 120 },
  checklistCard: { marginBottom: 8 },
  checklistHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  checklistInfo: { flex: 1, marginRight: 12 },
  checklistName: { fontSize: 16, fontWeight: "600", color: "#111827" },
  checklistMeta: { fontSize: 13, color: "#6b7280", marginTop: 4 },
  activeToggle: { flexDirection: "row", alignItems: "center", gap: 6 },
  activeLabel: { fontSize: 12, color: "#6b7280" },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  tapHint: { fontSize: 12, color: "#9ca3af", marginTop: 8 },
  bottomActions: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    gap: 8,
  },
  actionBtn: { width: "100%" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalSheet: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: "70%",
    padding: 16,
  },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#111827" },
  modalCloseText: { fontSize: 15, color: "#2563eb", fontWeight: "500" },
  noTemplates: { fontSize: 14, color: "#9ca3af", textAlign: "center", paddingVertical: 32 },
  templateItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  templateBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#eff6ff",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 4,
  },
  templateBadgeText: { fontSize: 11, fontWeight: "600", color: "#2563eb", textTransform: "capitalize" },
  templateName: { fontSize: 15, fontWeight: "600", color: "#111827" },
  templateDesc: { fontSize: 13, color: "#6b7280", marginTop: 2 },
  templateItemCount: { fontSize: 12, color: "#9ca3af", marginTop: 4 },
});
