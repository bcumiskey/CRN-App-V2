import {
  View,
  Text,
  ScrollView,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useGenerateMonthlyInvoice } from "../../../hooks/use-invoices";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";

// We pull owners from the properties hook if available, or handle inline
// For now we use a simple owner list — the backend returns owners from uninvoiced jobs
import { useUninvoicedJobs } from "../../../hooks/use-invoices";

function getCurrentPeriod() {
  const d = new Date();
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return `${months[d.getMonth()]} ${d.getFullYear()}`;
}

export default function GenerateMonthlyScreen() {
  const router = useRouter();
  const [selectedOwnerId, setSelectedOwnerId] = useState<string | null>(null);
  const [period, setPeriod] = useState(getCurrentPeriod());

  const generateMutation = useGenerateMonthlyInvoice();

  // Fetch uninvoiced jobs to derive unique owners
  const uninvoicedQuery = useUninvoicedJobs();
  const uninvoicedJobs = uninvoicedQuery.data ?? [];

  // Derive unique owners from uninvoiced jobs
  const ownersMap = new Map<string, { id: string; name: string; jobCount: number }>();
  for (const job of uninvoicedJobs) {
    const ownerId = job.property?.ownerId ?? job.ownerId;
    const ownerName = job.property?.owner?.name ?? job.ownerName ?? "Unknown";
    if (ownerId) {
      const existing = ownersMap.get(ownerId);
      if (existing) {
        existing.jobCount += 1;
      } else {
        ownersMap.set(ownerId, { id: ownerId, name: ownerName, jobCount: 1 });
      }
    }
  }
  const owners = Array.from(ownersMap.values());

  const selectedOwner = selectedOwnerId ? ownersMap.get(selectedOwnerId) : null;

  const handleGenerate = () => {
    if (!selectedOwnerId) {
      Alert.alert("Select Owner", "Please select an owner to generate an invoice for.");
      return;
    }
    if (!period.trim()) {
      Alert.alert("Enter Period", "Please enter a billing period (e.g. April 2026).");
      return;
    }

    generateMutation.mutate(
      { ownerId: selectedOwnerId, billingPeriod: period },
      {
        onSuccess: (data: any) => {
          const newId = data?.id;
          if (newId) {
            router.replace(`/(admin)/invoices/${newId}`);
          } else {
            Alert.alert("Success", "Monthly invoice generated.");
            router.back();
          }
        },
        onError: (err: any) => {
          Alert.alert("Error", err?.message ?? "Failed to generate invoice.");
        },
      }
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Generate Monthly Invoice</Text>
        <Text style={styles.subtitle}>
          Select an owner and billing period to generate an invoice from their uninvoiced completed jobs.
        </Text>

        {/* Period Picker */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Billing Period</Text>
          <TextInput
            style={styles.input}
            value={period}
            onChangeText={setPeriod}
            placeholder="e.g. April 2026"
            placeholderTextColor="#9ca3af"
          />
        </Card>

        {/* Owner Picker */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Select Owner</Text>
          {owners.length === 0 && (
            <Text style={styles.emptyText}>
              {uninvoicedQuery.isLoading
                ? "Loading owners..."
                : "No owners with uninvoiced jobs found."}
            </Text>
          )}
          {owners.map((owner) => (
            <TouchableOpacity
              key={owner.id}
              onPress={() => setSelectedOwnerId(owner.id)}
              style={[
                styles.ownerRow,
                selectedOwnerId === owner.id && styles.ownerRowSelected,
              ]}
            >
              <View style={styles.ownerInfo}>
                <Text style={[
                  styles.ownerName,
                  selectedOwnerId === owner.id && styles.ownerNameSelected,
                ]}>
                  {owner.name}
                </Text>
                <Text style={styles.ownerJobs}>
                  {owner.jobCount} uninvoiced job{owner.jobCount !== 1 ? "s" : ""}
                </Text>
              </View>
              {selectedOwnerId === owner.id && (
                <Text style={styles.checkmark}>&#10003;</Text>
              )}
            </TouchableOpacity>
          ))}
        </Card>

        {/* Preview */}
        {selectedOwner && (
          <Card style={styles.section}>
            <Text style={styles.previewTitle}>Preview</Text>
            <Text style={styles.previewText}>
              Will find uninvoiced completed jobs for {selectedOwner.name}'s properties
              in {period || "the selected period"}.
            </Text>
          </Card>
        )}

        {/* Generate Button */}
        <Button
          onPress={handleGenerate}
          variant="primary"
          size="lg"
          fullWidth
          loading={generateMutation.isPending}
          disabled={!selectedOwnerId}
        >
          Generate Invoice
        </Button>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  content: { padding: 16 },
  title: { fontSize: 22, fontWeight: "700", color: "#111827", marginBottom: 4 },
  subtitle: { fontSize: 14, color: "#6b7280", lineHeight: 20, marginBottom: 20 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 15, fontWeight: "600", color: "#111827", marginBottom: 10 },
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
  emptyText: { fontSize: 13, color: "#9ca3af", textAlign: "center", paddingVertical: 16 },
  ownerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: 8,
    backgroundColor: "#ffffff",
  },
  ownerRowSelected: {
    borderColor: "#2563eb",
    backgroundColor: "#eff6ff",
  },
  ownerInfo: {},
  ownerName: { fontSize: 15, fontWeight: "600", color: "#111827" },
  ownerNameSelected: { color: "#2563eb" },
  ownerJobs: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  checkmark: { fontSize: 18, color: "#2563eb", fontWeight: "700" },
  previewTitle: { fontSize: 14, fontWeight: "600", color: "#374151", marginBottom: 6 },
  previewText: { fontSize: 13, color: "#6b7280", lineHeight: 20 },
});
