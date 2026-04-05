import { View, Text, ScrollView, TextInput, StyleSheet, Alert } from "react-native";
import { useState, useEffect } from "react";
import { useSettings, useUpdateSettings } from "../../../../hooks/use-settings";
import { Card } from "../../../../components/ui/Card";
import { Button } from "../../../../components/ui/Button";

export default function FinancialModelScreen() {
  const settingsQuery = useSettings();
  const updateSettings = useUpdateSettings();

  const model = settingsQuery.data?.financialModel;
  const [buckets, setBuckets] = useState<Array<{ name: string; percent: string; type: string }>>([]);
  const [shareLevels, setShareLevels] = useState<Array<{ label: string; value: string }>>([]);

  useEffect(() => {
    if (model) {
      setBuckets(model.buckets.map((b) => ({ ...b, percent: String(b.percent) })));
      setShareLevels(model.shareLevels.map((s) => ({ ...s, value: String(s.value) })));
    }
  }, [model]);

  const bucketSum = buckets.reduce((sum, b) => sum + (parseFloat(b.percent) || 0), 0);
  const isValid = Math.abs(bucketSum - 100) < 0.01;

  const handleSave = async () => {
    if (!isValid) {
      Alert.alert("Invalid", `Bucket percentages sum to ${bucketSum}%. Must equal 100%.`);
      return;
    }
    try {
      await updateSettings.mutateAsync({
        financialModel: {
          buckets: buckets.map((b) => ({
            name: b.name,
            percent: parseFloat(b.percent) || 0,
            type: b.type,
          })),
          shareLevels: shareLevels.map((s) => ({
            label: s.label,
            value: parseFloat(s.value) || 0,
          })),
        },
      } as any);
      Alert.alert("Saved", "Financial model updated.");
    } catch {
      Alert.alert("Error", "Failed to save.");
    }
  };

  const updateBucket = (index: number, field: string, value: string) => {
    setBuckets(buckets.map((b, i) => (i === index ? { ...b, [field]: value } : b)));
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Financial Model</Text>
      <Text style={styles.subtitle}>Configure how job revenue is split into buckets.</Text>

      {/* Buckets */}
      <Text style={styles.sectionTitle}>Revenue Buckets</Text>
      {buckets.map((bucket, i) => (
        <Card key={i} style={styles.bucketCard}>
          <TextInput
            style={styles.input}
            value={bucket.name}
            onChangeText={(v) => updateBucket(i, "name", v)}
            placeholder="Bucket name"
          />
          <View style={styles.percentRow}>
            <TextInput
              style={[styles.input, styles.percentInput]}
              value={bucket.percent}
              onChangeText={(v) => updateBucket(i, "percent", v)}
              keyboardType="decimal-pad"
              placeholder="0"
            />
            <Text style={styles.percentSign}>%</Text>
            <Text style={styles.bucketType}>{bucket.type}</Text>
          </View>
        </Card>
      ))}

      <View style={styles.sumRow}>
        <Text style={[styles.sumText, !isValid && styles.sumError]}>
          Total: {bucketSum}% {isValid ? "✓" : `(must be 100%)`}
        </Text>
      </View>

      {/* Share Levels */}
      <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Share Levels</Text>
      <Text style={styles.subtitle}>Available share levels for crew assignments.</Text>
      {shareLevels.map((level, i) => (
        <View key={i} style={styles.shareRow}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            value={level.label}
            onChangeText={(v) =>
              setShareLevels(shareLevels.map((s, j) => (j === i ? { ...s, label: v } : s)))
            }
            placeholder="Label"
          />
          <TextInput
            style={[styles.input, styles.shareInput]}
            value={level.value}
            onChangeText={(v) =>
              setShareLevels(shareLevels.map((s, j) => (j === i ? { ...s, value: v } : s)))
            }
            keyboardType="decimal-pad"
            placeholder="0.0"
          />
        </View>
      ))}

      <View style={styles.actions}>
        <Button variant="primary" onPress={handleSave} loading={updateSettings.isPending} fullWidth disabled={!isValid}>
          Save Financial Model
        </Button>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  content: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: "700", color: "#111827" },
  subtitle: { fontSize: 14, color: "#6b7280", marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontWeight: "600", color: "#6b7280", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 },
  bucketCard: { marginBottom: 8 },
  input: {
    borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8, fontSize: 15,
    backgroundColor: "#ffffff", color: "#111827", marginBottom: 6,
  },
  percentRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  percentInput: { width: 80, marginBottom: 0 },
  percentSign: { fontSize: 16, color: "#6b7280" },
  bucketType: { fontSize: 12, color: "#9ca3af", flex: 1, textAlign: "right" },
  sumRow: { alignItems: "center", marginTop: 8 },
  sumText: { fontSize: 15, fontWeight: "600", color: "#16a34a" },
  sumError: { color: "#dc2626" },
  shareRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  shareInput: { width: 80 },
  actions: { marginTop: 24 },
});
