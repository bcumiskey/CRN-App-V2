import {
  View,
  Text,
  ScrollView,
  TextInput,
  Alert,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { useState, useMemo } from "react";
import { useCreateMileage, useMileageSummary } from "../../../hooks/use-mileage";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function AddMileageScreen() {
  const router = useRouter();
  const createMileage = useCreateMileage();
  const summaryQuery = useMileageSummary();
  const rate = summaryQuery.data?.currentRate ?? 0.67;

  const [date, setDate] = useState(todayStr());
  const [startLocation, setStartLocation] = useState("");
  const [endLocation, setEndLocation] = useState("");
  const [miles, setMiles] = useState("");
  const [purpose, setPurpose] = useState("");

  const milesNum = parseFloat(miles) || 0;
  const deductionPreview = milesNum * rate;

  const handleSave = () => {
    if (milesNum <= 0) {
      Alert.alert("Invalid Miles", "Please enter a mileage value greater than zero.");
      return;
    }
    if (!date) {
      Alert.alert("Missing Date", "Please enter a date.");
      return;
    }

    createMileage.mutate(
      {
        date,
        miles: milesNum,
        startLocation: startLocation || undefined,
        endLocation: endLocation || undefined,
        purpose: purpose || undefined,
      },
      {
        onSuccess: () => router.back(),
        onError: (err: any) => Alert.alert("Error", err?.message ?? "Failed to save mileage entry."),
      }
    );
  };

  const handleStartTrip = () => {
    Alert.alert(
      "Coming Soon",
      "GPS tracking will be available in a future update. For now, please enter your mileage manually."
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Add Mileage</Text>

        {/* Date */}
        <Card style={styles.section}>
          <Text style={styles.fieldLabel}>Date</Text>
          <TextInput
            style={styles.input}
            value={date}
            onChangeText={setDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#9ca3af"
          />
        </Card>

        {/* Locations */}
        <Card style={styles.section}>
          <Text style={styles.fieldLabel}>Start Location</Text>
          <TextInput
            style={styles.input}
            value={startLocation}
            onChangeText={setStartLocation}
            placeholder="Starting address or location"
            placeholderTextColor="#9ca3af"
          />

          <Text style={[styles.fieldLabel, { marginTop: 12 }]}>End Location</Text>
          <TextInput
            style={styles.input}
            value={endLocation}
            onChangeText={setEndLocation}
            placeholder="Destination address or location"
            placeholderTextColor="#9ca3af"
          />
        </Card>

        {/* Miles + Purpose */}
        <Card style={styles.section}>
          <Text style={styles.fieldLabel}>Miles</Text>
          <TextInput
            style={styles.input}
            value={miles}
            onChangeText={setMiles}
            placeholder="0.0"
            placeholderTextColor="#9ca3af"
            keyboardType="decimal-pad"
          />

          <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Purpose</Text>
          <TextInput
            style={styles.input}
            value={purpose}
            onChangeText={setPurpose}
            placeholder="Business purpose of trip"
            placeholderTextColor="#9ca3af"
          />
        </Card>

        {/* Rate + Deduction Preview */}
        <Card style={styles.section}>
          <View style={styles.previewRow}>
            <Text style={styles.previewLabel}>IRS Rate</Text>
            <Text style={styles.previewValue}>${rate}/mile</Text>
          </View>
          <View style={[styles.previewRow, styles.deductionRow]}>
            <Text style={styles.deductionLabel}>Estimated Deduction</Text>
            <Text style={styles.deductionValue}>
              ${deductionPreview.toFixed(2)}
            </Text>
          </View>
          {milesNum > 0 && (
            <Text style={styles.formula}>
              {milesNum.toFixed(1)} mi x ${rate}/mi = ${deductionPreview.toFixed(2)}
            </Text>
          )}
        </Card>

        {/* Actions */}
        <View style={styles.actions}>
          <Button
            onPress={handleSave}
            variant="primary"
            size="lg"
            fullWidth
            loading={createMileage.isPending}
          >
            Save Mileage
          </Button>

          <Button
            onPress={handleStartTrip}
            variant="outline"
            size="md"
            fullWidth
          >
            Start Trip (GPS)
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
  previewRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  previewLabel: { fontSize: 13, color: "#6b7280" },
  previewValue: { fontSize: 14, fontWeight: "500", color: "#374151" },
  deductionRow: {
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
    marginTop: 4,
    paddingTop: 10,
  },
  deductionLabel: { fontSize: 15, fontWeight: "600", color: "#111827" },
  deductionValue: { fontSize: 20, fontWeight: "700", color: "#16a34a" },
  formula: {
    fontSize: 12,
    color: "#9ca3af",
    textAlign: "right",
    marginTop: 4,
  },
  actions: { gap: 10, marginTop: 8 },
});
