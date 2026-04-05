import { View, Text, ScrollView, TextInput, StyleSheet, Alert } from "react-native";
import { useState, useEffect } from "react";
import { useSettings, useUpdateSettings } from "../../../../hooks/use-settings";
import { Card } from "../../../../components/ui/Card";
import { Button } from "../../../../components/ui/Button";

export default function NumberingSettingsScreen() {
  const settingsQuery = useSettings();
  const updateSettings = useUpdateSettings();
  const s = settingsQuery.data;

  const [jobPrefix, setJobPrefix] = useState("JOB");
  const [jobNextNumber, setJobNextNumber] = useState("1");
  const [invoicePrefix, setInvoicePrefix] = useState("INV");
  const [invoiceNextNumber, setInvoiceNextNumber] = useState("1");
  const [defaultPaymentTerms, setDefaultPaymentTerms] = useState("Due upon receipt");
  const [payPeriodType, setPayPeriodType] = useState("monthly");

  useEffect(() => {
    if (s) {
      setJobPrefix(s.jobPrefix);
      setJobNextNumber(String(s.jobNextNumber));
      setInvoicePrefix(s.invoicePrefix);
      setInvoiceNextNumber(String(s.invoiceNextNumber));
      setDefaultPaymentTerms(s.defaultPaymentTerms);
      setPayPeriodType(s.payPeriodType);
    }
  }, [s]);

  const handleSave = async () => {
    try {
      await updateSettings.mutateAsync({
        jobPrefix,
        jobNextNumber: parseInt(jobNextNumber) || 1,
        invoicePrefix,
        invoiceNextNumber: parseInt(invoiceNextNumber) || 1,
        defaultPaymentTerms,
        payPeriodType,
      } as any);
      Alert.alert("Saved", "Numbering settings updated.");
    } catch {
      Alert.alert("Error", "Failed to save.");
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Numbering & Periods</Text>

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Job Numbers</Text>
        <Text style={styles.preview}>Preview: {jobPrefix}-2026-{String(parseInt(jobNextNumber) || 1).padStart(4, "0")}</Text>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Prefix</Text>
            <TextInput style={styles.input} value={jobPrefix} onChangeText={setJobPrefix} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Next Number</Text>
            <TextInput style={styles.input} value={jobNextNumber} onChangeText={setJobNextNumber} keyboardType="number-pad" />
          </View>
        </View>
      </Card>

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Invoice Numbers</Text>
        <Text style={styles.preview}>Preview: {invoicePrefix}-2026-{String(parseInt(invoiceNextNumber) || 1).padStart(4, "0")}</Text>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Prefix</Text>
            <TextInput style={styles.input} value={invoicePrefix} onChangeText={setInvoicePrefix} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Next Number</Text>
            <TextInput style={styles.input} value={invoiceNextNumber} onChangeText={setInvoiceNextNumber} keyboardType="number-pad" />
          </View>
        </View>
      </Card>

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Billing</Text>
        <Text style={styles.label}>Default Payment Terms</Text>
        <TextInput style={styles.input} value={defaultPaymentTerms} onChangeText={setDefaultPaymentTerms} />

        <Text style={[styles.label, { marginTop: 12 }]}>Pay Period Type</Text>
        <View style={styles.pillRow}>
          {["weekly", "biweekly", "monthly"].map((type) => (
            <Button
              key={type}
              variant={payPeriodType === type ? "primary" : "outline"}
              size="sm"
              onPress={() => setPayPeriodType(type)}
            >
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </Button>
          ))}
        </View>
      </Card>

      <View style={styles.actions}>
        <Button variant="primary" onPress={handleSave} loading={updateSettings.isPending} fullWidth>
          Save
        </Button>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  content: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: "700", color: "#111827", marginBottom: 16 },
  section: { marginBottom: 12 },
  sectionTitle: { fontSize: 13, fontWeight: "600", color: "#6b7280", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 },
  preview: { fontSize: 14, color: "#3b82f6", fontWeight: "500", marginBottom: 10, fontFamily: "monospace" },
  label: { fontSize: 14, fontWeight: "500", color: "#374151", marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 15,
    backgroundColor: "#ffffff", color: "#111827",
  },
  row: { flexDirection: "row", gap: 12 },
  pillRow: { flexDirection: "row", gap: 6 },
  actions: { marginTop: 16 },
});
