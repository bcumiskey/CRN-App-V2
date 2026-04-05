import { View, Text, ScrollView, TextInput, StyleSheet, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useWorkerProperties, useWorkerAddNote } from "../../hooks/use-worker";
import { Button } from "../../components/ui/Button";

const noteTypes = ["general", "damage", "maintenance"];

export default function WorkerAddNoteScreen() {
  const router = useRouter();
  const propertiesQuery = useWorkerProperties();
  const addNote = useWorkerAddNote();

  const properties = propertiesQuery.data ?? [];

  const [propertyId, setPropertyId] = useState("");
  const [content, setContent] = useState("");
  const [noteType, setNoteType] = useState("general");

  const handleSave = async () => {
    if (!propertyId || !content.trim()) {
      Alert.alert("Required", "Select a property and enter a note.");
      return;
    }
    try {
      await addNote.mutateAsync({
        propertyId,
        content: content.trim(),
        noteType,
      });
      Alert.alert("Saved", "Note added successfully.");
      router.back();
    } catch {
      Alert.alert("Error", "Failed to save note.");
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Add Note</Text>

      <Text style={styles.label}>Property</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillScroll}>
        {properties.map((p) => (
          <Button
            key={p.id}
            variant={propertyId === p.id ? "primary" : "outline"}
            size="sm"
            onPress={() => setPropertyId(p.id)}
          >
            {p.name}
          </Button>
        ))}
      </ScrollView>

      <Text style={styles.label}>Type</Text>
      <View style={styles.typeRow}>
        {noteTypes.map((type) => (
          <Button
            key={type}
            variant={noteType === type ? "primary" : "outline"}
            size="sm"
            onPress={() => setNoteType(type)}
          >
            {type.charAt(0).toUpperCase() + type.slice(1)}
          </Button>
        ))}
      </View>

      <Text style={styles.label}>Note</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={content}
        onChangeText={setContent}
        placeholder="Describe the issue, observation, or note..."
        multiline
        numberOfLines={5}
      />

      <View style={styles.actions}>
        <Button variant="primary" onPress={handleSave} loading={addNote.isPending} fullWidth>
          Save Note
        </Button>
        <Button variant="ghost" onPress={() => router.back()} fullWidth>
          Cancel
        </Button>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  content: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: "700", color: "#111827", marginBottom: 20 },
  label: { fontSize: 14, fontWeight: "500", color: "#374151", marginBottom: 6, marginTop: 12 },
  pillScroll: { flexDirection: "row", gap: 8 },
  typeRow: { flexDirection: "row", gap: 6 },
  input: {
    borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 16,
    backgroundColor: "#ffffff", color: "#111827",
  },
  textArea: { minHeight: 120, textAlignVertical: "top" },
  actions: { marginTop: 24, gap: 10 },
});
