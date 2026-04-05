import { View, Text, ScrollView, TextInput, StyleSheet, Alert } from "react-native";
import { useState, useEffect } from "react";
import { useSettings, useUpdateSettings } from "../../../hooks/use-settings";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";

export default function BusinessSettingsScreen() {
  const settingsQuery = useSettings();
  const updateSettings = useUpdateSettings();
  const s = settingsQuery.data;

  const [businessName, setBusinessName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  useEffect(() => {
    if (s) {
      setBusinessName(s.businessName);
      setOwnerName(s.ownerName);
      setEmail(s.email);
      setPhone(s.phone);
      setAddress(s.address);
    }
  }, [s]);

  const handleSave = async () => {
    try {
      await updateSettings.mutateAsync({ businessName, ownerName, email, phone, address } as any);
      Alert.alert("Saved", "Business info updated.");
    } catch {
      Alert.alert("Error", "Failed to save.");
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Business Info</Text>

      <Card>
        <Field label="Business Name" value={businessName} onChange={setBusinessName} />
        <Field label="Owner Name" value={ownerName} onChange={setOwnerName} />
        <Field label="Email" value={email} onChange={setEmail} keyboard="email-address" />
        <Field label="Phone" value={phone} onChange={setPhone} keyboard="phone-pad" />
        <Field label="Address" value={address} onChange={setAddress} multiline />
      </Card>

      <View style={styles.actions}>
        <Button variant="primary" onPress={handleSave} loading={updateSettings.isPending} fullWidth>
          Save
        </Button>
      </View>
    </ScrollView>
  );
}

function Field({ label, value, onChange, keyboard, multiline }: {
  label: string; value: string; onChange: (v: string) => void;
  keyboard?: any; multiline?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.multiline]}
        value={value}
        onChangeText={onChange}
        keyboardType={keyboard}
        multiline={multiline}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  content: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: "700", color: "#111827", marginBottom: 16 },
  field: { marginBottom: 14 },
  label: { fontSize: 14, fontWeight: "500", color: "#374151", marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 15,
    backgroundColor: "#ffffff", color: "#111827",
  },
  multiline: { minHeight: 80, textAlignVertical: "top" },
  actions: { marginTop: 16 },
});
