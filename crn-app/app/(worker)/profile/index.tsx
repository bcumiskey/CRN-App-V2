import { View, Text, ScrollView, TextInput, StyleSheet, Alert } from "react-native";
import { useState, useEffect } from "react";
import { useWorkerProfile, useWorkerUpdateProfile } from "../../../hooks/use-worker";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";

export default function WorkerProfileScreen() {
  const profileQuery = useWorkerProfile();
  const updateProfile = useWorkerUpdateProfile();
  const profile = profileQuery.data;

  const [phone, setPhone] = useState("");
  const [emergencyContact, setEmergencyContact] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");

  useEffect(() => {
    if (profile) {
      setPhone(profile.phone ?? "");
      setEmergencyContact(profile.emergencyContact ?? "");
      setEmergencyPhone(profile.emergencyPhone ?? "");
    }
  }, [profile]);

  const handleSave = async () => {
    try {
      await updateProfile.mutateAsync({
        phone: phone || undefined,
        emergencyContact: emergencyContact || undefined,
        emergencyPhone: emergencyPhone || undefined,
      });
      Alert.alert("Saved", "Profile updated.");
    } catch {
      Alert.alert("Error", "Failed to save.");
    }
  };

  if (!profile) return <View style={styles.loading}><Text>Loading...</Text></View>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{profile.name.charAt(0).toUpperCase()}</Text>
        </View>
        <Text style={styles.name}>{profile.name}</Text>
        <Text style={styles.email}>{profile.email}</Text>
      </View>

      <Card>
        <Text style={styles.sectionTitle}>Contact Info</Text>
        <Text style={styles.label}>Phone</Text>
        <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="555-123-4567" />

        <Text style={[styles.label, { marginTop: 12 }]}>Emergency Contact</Text>
        <TextInput style={styles.input} value={emergencyContact} onChangeText={setEmergencyContact} placeholder="Contact name" />

        <Text style={[styles.label, { marginTop: 12 }]}>Emergency Phone</Text>
        <TextInput style={styles.input} value={emergencyPhone} onChangeText={setEmergencyPhone} keyboardType="phone-pad" placeholder="555-987-6543" />
      </Card>

      <View style={styles.actions}>
        <Button variant="primary" onPress={handleSave} loading={updateProfile.isPending} fullWidth>
          Save
        </Button>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  content: { padding: 16, paddingBottom: 40 },
  loading: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { alignItems: "center", marginBottom: 20 },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: "#dbeafe", alignItems: "center", justifyContent: "center", marginBottom: 8 },
  avatarText: { fontSize: 30, fontWeight: "700", color: "#2563eb" },
  name: { fontSize: 22, fontWeight: "700", color: "#111827" },
  email: { fontSize: 14, color: "#6b7280" },
  sectionTitle: { fontSize: 13, fontWeight: "600", color: "#6b7280", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 },
  label: { fontSize: 14, fontWeight: "500", color: "#374151", marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 15,
    backgroundColor: "#ffffff", color: "#111827",
  },
  actions: { marginTop: 16 },
});
