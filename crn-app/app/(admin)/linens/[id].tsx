import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useState, useCallback, useEffect } from "react";
import {
  useLinen,
  useUpdateLinen,
  useAddLinenRequirement,
} from "../../../hooks/use-linens";
import { useProperties } from "../../../hooks/use-properties";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { CurrencyInput } from "../../../components/ui/CurrencyInput";

function fmt(n: number) {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function LinenDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const linenQuery = useLinen(id);
  const propertiesQuery = useProperties();
  const updateLinen = useUpdateLinen();
  const addRequirement = useAddLinenRequirement();

  const linen = linenQuery.data;
  const allProperties = propertiesQuery.data ?? [];

  // Editable state
  const [onHand, setOnHand] = useState(0);
  const [unitCost, setUnitCost] = useState(0);
  const [vendor, setVendor] = useState("");
  const [dirty, setDirty] = useState(false);

  // Requirement add state
  const [showAddReq, setShowAddReq] = useState(false);
  const [reqPropertyId, setReqPropertyId] = useState<string | undefined>();
  const [reqQuantity, setReqQuantity] = useState("");

  // Sync state from server
  useEffect(() => {
    if (linen) {
      setOnHand(linen.onHand);
      setUnitCost(linen.unitCost);
      setVendor(linen.vendor);
      setDirty(false);
    }
  }, [linen]);

  // Computed target
  const target = linen
    ? linen.requirements.reduce((sum, r) => sum + r.quantityPerFlip, 0)
    : 0;

  const deficit = target - onHand;
  const isOk = deficit <= 0;

  const handleSave = useCallback(() => {
    if (!id) return;
    updateLinen.mutate({ id, onHand, unitCost, vendor });
  }, [id, onHand, unitCost, vendor, updateLinen]);

  const handleAddRequirement = useCallback(() => {
    if (!id || !reqPropertyId || !reqQuantity) return;
    const qty = parseInt(reqQuantity, 10);
    if (isNaN(qty) || qty <= 0) {
      Alert.alert("Invalid", "Enter a valid quantity.");
      return;
    }
    addRequirement.mutate(
      { linenId: id, propertyId: reqPropertyId, quantityPerFlip: qty },
      {
        onSuccess: () => {
          setShowAddReq(false);
          setReqPropertyId(undefined);
          setReqQuantity("");
        },
      }
    );
  }, [id, reqPropertyId, reqQuantity, addRequirement]);

  // Properties not yet assigned
  const availableProperties = allProperties.filter(
    (p) => !linen?.requirements.some((r) => r.propertyId === p.id)
  );

  if (!linen) {
    return (
      <View style={styles.loading}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <Text style={styles.name}>{linen.name}</Text>
      <Text style={styles.code}>{linen.code}</Text>
      <View style={styles.categoryRow}>
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryBadgeText}>{linen.category}</Text>
        </View>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: isOk ? "#dcfce7" : "#fef3c7" },
          ]}
        >
          <Text
            style={[
              styles.statusBadgeText,
              { color: isOk ? "#16a34a" : "#d97706" },
            ]}
          >
            {isOk ? "\u2713 OK" : `\u26A0 Deficit: ${deficit}`}
          </Text>
        </View>
      </View>

      {/* On-Hand Stepper */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>On Hand</Text>
        <View style={styles.stepperRow}>
          <TouchableOpacity
            style={styles.stepperBtn}
            onPress={() => {
              setOnHand((v) => Math.max(0, v - 1));
              setDirty(true);
            }}
          >
            <Text style={styles.stepperBtnText}>-</Text>
          </TouchableOpacity>
          <TextInput
            style={styles.stepperInput}
            value={String(onHand)}
            onChangeText={(t) => {
              const n = parseInt(t, 10);
              if (!isNaN(n) && n >= 0) {
                setOnHand(n);
                setDirty(true);
              } else if (t === "") {
                setOnHand(0);
                setDirty(true);
              }
            }}
            keyboardType="number-pad"
            selectTextOnFocus
          />
          <TouchableOpacity
            style={styles.stepperBtn}
            onPress={() => {
              setOnHand((v) => v + 1);
              setDirty(true);
            }}
          >
            <Text style={styles.stepperBtnText}>+</Text>
          </TouchableOpacity>
        </View>
      </Card>

      {/* Unit Cost */}
      <Card style={styles.section}>
        <CurrencyInput
          label="Unit Cost"
          value={unitCost}
          onChangeValue={(v) => {
            setUnitCost(v);
            setDirty(true);
          }}
        />
      </Card>

      {/* Vendor */}
      <Card style={styles.section}>
        <Text style={styles.fieldLabel}>Vendor</Text>
        <TextInput
          style={styles.textInput}
          value={vendor}
          onChangeText={(t) => {
            setVendor(t);
            setDirty(true);
          }}
          placeholder="Vendor name"
          placeholderTextColor="#9ca3af"
        />
      </Card>

      {/* Target (read-only) */}
      <Card style={styles.section}>
        <InfoRow label="Target (computed)" value={String(target)} />
      </Card>

      {/* Save Button */}
      {dirty && (
        <Button
          onPress={handleSave}
          variant="primary"
          fullWidth
          loading={updateLinen.isPending}
          style={styles.saveButton}
        >
          Save Changes
        </Button>
      )}

      {/* Requirements */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Property Requirements</Text>
        {linen.requirements.length === 0 ? (
          <Text style={styles.emptyText}>No property requirements</Text>
        ) : (
          linen.requirements.map((req) => (
            <View key={req.id} style={styles.reqRow}>
              <Text style={styles.reqPropertyName}>{req.propertyName}</Text>
              <Text style={styles.reqQty}>{"\u00D7"} {req.quantityPerFlip} per flip</Text>
            </View>
          ))
        )}

        {/* Add Requirement */}
        {!showAddReq ? (
          <Button
            onPress={() => setShowAddReq(true)}
            variant="outline"
            size="sm"
            style={styles.addReqBtn}
          >
            + Add Requirement
          </Button>
        ) : (
          <View style={styles.addReqForm}>
            <Text style={styles.fieldLabel}>Property</Text>
            <View style={styles.propertyPicker}>
              {availableProperties.length === 0 ? (
                <Text style={styles.emptyText}>All properties already assigned</Text>
              ) : (
                availableProperties.map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    onPress={() => setReqPropertyId(p.id)}
                    style={[
                      styles.propertyChip,
                      reqPropertyId === p.id && styles.propertyChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.propertyChipText,
                        reqPropertyId === p.id && styles.propertyChipTextActive,
                      ]}
                    >
                      {p.name}
                    </Text>
                  </TouchableOpacity>
                ))
              )}
            </View>
            <Text style={styles.fieldLabel}>Quantity per Flip</Text>
            <TextInput
              style={styles.textInput}
              value={reqQuantity}
              onChangeText={setReqQuantity}
              keyboardType="number-pad"
              placeholder="e.g. 4"
              placeholderTextColor="#9ca3af"
            />
            <View style={styles.addReqActions}>
              <Button
                onPress={() => {
                  setShowAddReq(false);
                  setReqPropertyId(undefined);
                  setReqQuantity("");
                }}
                variant="ghost"
                size="sm"
              >
                Cancel
              </Button>
              <Button
                onPress={handleAddRequirement}
                variant="primary"
                size="sm"
                loading={addRequirement.isPending}
                disabled={!reqPropertyId || !reqQuantity}
              >
                Add
              </Button>
            </View>
          </View>
        )}
      </Card>
    </ScrollView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  content: { padding: 16, paddingBottom: 40 },
  loading: { flex: 1, justifyContent: "center", alignItems: "center" },
  name: { fontSize: 24, fontWeight: "700", color: "#111827" },
  code: { fontSize: 13, color: "#9ca3af", marginBottom: 8 },
  categoryRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  categoryBadge: {
    backgroundColor: "#f3f4f6",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryBadgeText: { fontSize: 12, fontWeight: "500", color: "#6b7280" },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: { fontSize: 12, fontWeight: "600" },
  section: { marginBottom: 12 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6b7280",
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
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
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  infoLabel: { fontSize: 14, color: "#6b7280" },
  infoValue: { fontSize: 14, color: "#111827", fontWeight: "500" },
  saveButton: { marginBottom: 12 },
  emptyText: { fontSize: 14, color: "#9ca3af", fontStyle: "italic" },
  reqRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  reqPropertyName: { fontSize: 14, fontWeight: "500", color: "#111827" },
  reqQty: { fontSize: 13, color: "#6b7280" },
  addReqBtn: { marginTop: 12 },
  addReqForm: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
  },
  propertyPicker: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  propertyChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#f3f4f6",
  },
  propertyChipActive: { backgroundColor: "#dbeafe" },
  propertyChipText: { fontSize: 13, color: "#6b7280" },
  propertyChipTextActive: { color: "#2563eb", fontWeight: "600" },
  addReqActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 12,
  },
});
