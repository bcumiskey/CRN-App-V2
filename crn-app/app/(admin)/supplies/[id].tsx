import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState, useCallback, useEffect } from "react";
import {
  useSupply,
  useCreateSupply,
  useUpdateSupply,
  useDeleteSupply,
} from "../../../hooks/use-supplies";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { CurrencyInput } from "../../../components/ui/CurrencyInput";

const CATEGORIES = ["Cleaning", "Paper", "Laundry", "Equipment", "Other"];

export default function SupplyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const isNew = id === "new";

  const supplyQuery = useSupply(isNew ? undefined : id);
  const createSupply = useCreateSupply();
  const updateSupply = useUpdateSupply();
  const deleteSupply = useDeleteSupply();

  const supply = supplyQuery.data;

  // Editable fields
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Cleaning");
  const [onHand, setOnHand] = useState(0);
  const [reorderLevel, setReorderLevel] = useState(0);
  const [reorderQuantity, setReorderQuantity] = useState(0);
  const [unitCost, setUnitCost] = useState(0);
  const [unit, setUnit] = useState("");
  const [vendor, setVendor] = useState("");

  // Sync from server
  useEffect(() => {
    if (supply) {
      setName(supply.name);
      setCategory(supply.category);
      setOnHand(supply.onHand);
      setReorderLevel(supply.reorderLevel);
      setReorderQuantity(supply.reorderQuantity);
      setUnitCost(supply.unitCost);
      setUnit(supply.unit);
      setVendor(supply.vendor);
    }
  }, [supply]);

  const handleSave = useCallback(() => {
    if (!name.trim()) {
      Alert.alert("Required", "Supply name is required.");
      return;
    }
    const data = {
      name: name.trim(),
      category,
      onHand,
      reorderLevel,
      reorderQuantity,
      unitCost,
      unit: unit.trim(),
      vendor: vendor.trim(),
    };
    if (isNew) {
      createSupply.mutate(data, {
        onSuccess: (created) => {
          router.replace(`/(admin)/supplies/${created.id}` as any);
        },
      });
    } else if (id) {
      updateSupply.mutate({ id, ...data });
    }
  }, [
    name, category, onHand, reorderLevel, reorderQuantity,
    unitCost, unit, vendor, isNew, id, createSupply, updateSupply, router,
  ]);

  const handleDelete = useCallback(() => {
    if (!id || isNew) return;
    Alert.alert("Delete Supply", `Are you sure you want to delete "${name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          deleteSupply.mutate(id, {
            onSuccess: () => router.back(),
          });
        },
      },
    ]);
  }, [id, isNew, name, deleteSupply, router]);

  if (!isNew && !supply) {
    return (
      <View style={styles.loading}>
        <Text>Loading...</Text>
      </View>
    );
  }

  const isSaving = createSupply.isPending || updateSupply.isPending;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Name */}
      <Card style={styles.section}>
        <Text style={styles.fieldLabel}>Name</Text>
        <TextInput
          style={styles.textInput}
          value={name}
          onChangeText={setName}
          placeholder="Supply name"
          placeholderTextColor="#9ca3af"
        />
      </Card>

      {/* Category */}
      <Card style={styles.section}>
        <Text style={styles.fieldLabel}>Category</Text>
        <View style={styles.chipRow}>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat}
              onPress={() => setCategory(cat)}
              style={[styles.chip, category === cat && styles.chipActive]}
            >
              <Text style={[styles.chipText, category === cat && styles.chipTextActive]}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </Card>

      {/* On-Hand Stepper */}
      <Card style={styles.section}>
        <Text style={styles.fieldLabel}>On Hand</Text>
        <View style={styles.stepperRow}>
          <TouchableOpacity
            style={styles.stepperBtn}
            onPress={() => setOnHand((v) => Math.max(0, v - 1))}
          >
            <Text style={styles.stepperBtnText}>-</Text>
          </TouchableOpacity>
          <TextInput
            style={styles.stepperInput}
            value={String(onHand)}
            onChangeText={(t) => {
              const n = parseInt(t, 10);
              if (!isNaN(n) && n >= 0) setOnHand(n);
              else if (t === "") setOnHand(0);
            }}
            keyboardType="number-pad"
            selectTextOnFocus
          />
          <TouchableOpacity
            style={styles.stepperBtn}
            onPress={() => setOnHand((v) => v + 1)}
          >
            <Text style={styles.stepperBtnText}>+</Text>
          </TouchableOpacity>
        </View>
      </Card>

      {/* Reorder Level */}
      <Card style={styles.section}>
        <Text style={styles.fieldLabel}>Reorder Level</Text>
        <TextInput
          style={styles.textInput}
          value={String(reorderLevel)}
          onChangeText={(t) => {
            const n = parseInt(t, 10);
            if (!isNaN(n) && n >= 0) setReorderLevel(n);
            else if (t === "") setReorderLevel(0);
          }}
          keyboardType="number-pad"
          placeholder="0"
          placeholderTextColor="#9ca3af"
        />
      </Card>

      {/* Reorder Quantity */}
      <Card style={styles.section}>
        <Text style={styles.fieldLabel}>Reorder Quantity</Text>
        <TextInput
          style={styles.textInput}
          value={String(reorderQuantity)}
          onChangeText={(t) => {
            const n = parseInt(t, 10);
            if (!isNaN(n) && n >= 0) setReorderQuantity(n);
            else if (t === "") setReorderQuantity(0);
          }}
          keyboardType="number-pad"
          placeholder="0"
          placeholderTextColor="#9ca3af"
        />
      </Card>

      {/* Unit Cost */}
      <Card style={styles.section}>
        <CurrencyInput
          label="Unit Cost"
          value={unitCost}
          onChangeValue={setUnitCost}
        />
      </Card>

      {/* Unit */}
      <Card style={styles.section}>
        <Text style={styles.fieldLabel}>Unit</Text>
        <TextInput
          style={styles.textInput}
          value={unit}
          onChangeText={setUnit}
          placeholder="e.g. bottle, roll, each"
          placeholderTextColor="#9ca3af"
        />
      </Card>

      {/* Vendor */}
      <Card style={styles.section}>
        <Text style={styles.fieldLabel}>Vendor</Text>
        <TextInput
          style={styles.textInput}
          value={vendor}
          onChangeText={setVendor}
          placeholder="Vendor name"
          placeholderTextColor="#9ca3af"
        />
      </Card>

      {/* Actions */}
      <Button
        onPress={handleSave}
        variant="primary"
        fullWidth
        loading={isSaving}
        style={styles.saveButton}
      >
        {isNew ? "Create Supply" : "Save Changes"}
      </Button>

      {!isNew && (
        <Button
          onPress={handleDelete}
          variant="danger"
          fullWidth
          loading={deleteSupply.isPending}
          style={styles.deleteButton}
        >
          Delete Supply
        </Button>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  content: { padding: 16, paddingBottom: 40 },
  loading: { flex: 1, justifyContent: "center", alignItems: "center" },
  section: { marginBottom: 12 },
  fieldLabel: { fontSize: 14, fontWeight: "500", color: "#374151", marginBottom: 6 },
  textInput: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: "#ffffff",
    color: "#111827",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#f3f4f6",
  },
  chipActive: { backgroundColor: "#dbeafe" },
  chipText: { fontSize: 13, color: "#6b7280", fontWeight: "500" },
  chipTextActive: { color: "#2563eb", fontWeight: "600" },
  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  stepperBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
  },
  stepperBtnText: { fontSize: 22, fontWeight: "600", color: "#374151" },
  stepperInput: {
    fontSize: 28,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
    minWidth: 80,
    borderBottomWidth: 2,
    borderBottomColor: "#d1d5db",
    paddingVertical: 4,
  },
  saveButton: { marginTop: 8, marginBottom: 12 },
  deleteButton: { marginBottom: 12 },
});
