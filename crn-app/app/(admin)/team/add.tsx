import { View, Text, ScrollView, TextInput, StyleSheet, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useCreateTeamMember } from "../../../hooks/use-team";
import { useSettings } from "../../../hooks/use-settings";
import { Button } from "../../../components/ui/Button";
import { SharePills } from "../../../components/domain/SharePills";

export default function AddTeamMemberScreen() {
  const router = useRouter();
  const createMember = useCreateTeamMember();
  const settingsQuery = useSettings();
  const shareLevels = settingsQuery.data?.financialModel?.shareLevels;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("worker");
  const [defaultShare, setDefaultShare] = useState(1.0);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = "Name is required";
    if (!email.trim()) errs.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(email)) errs.email = "Invalid email format";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    try {
      await createMember.mutateAsync({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim() || undefined,
        role,
        defaultShare,
      });
      router.back();
    } catch {
      Alert.alert("Error", "Failed to create team member.");
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Add Team Member</Text>

      <Text style={styles.label}>Name *</Text>
      <TextInput
        style={[styles.input, errors.name ? styles.inputError : null]}
        value={name}
        onChangeText={setName}
        placeholder="Full name"
      />
      {errors.name && <Text style={styles.error}>{errors.name}</Text>}

      <Text style={styles.label}>Email *</Text>
      <TextInput
        style={[styles.input, errors.email ? styles.inputError : null]}
        value={email}
        onChangeText={setEmail}
        placeholder="email@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
      />
      {errors.email && <Text style={styles.error}>{errors.email}</Text>}

      <Text style={styles.label}>Phone</Text>
      <TextInput
        style={styles.input}
        value={phone}
        onChangeText={setPhone}
        placeholder="555-123-4567"
        keyboardType="phone-pad"
      />

      <Text style={styles.label}>Role</Text>
      <View style={styles.roleRow}>
        <Button variant={role === "worker" ? "primary" : "outline"} size="sm" onPress={() => setRole("worker")}>
          Worker
        </Button>
        <Button variant={role === "admin" ? "primary" : "outline"} size="sm" onPress={() => setRole("admin")}>
          Admin
        </Button>
      </View>

      <Text style={styles.label}>Default Share</Text>
      <SharePills value={defaultShare} onChange={setDefaultShare} shareLevels={shareLevels} />

      <View style={styles.actions}>
        <Button variant="primary" onPress={handleSave} loading={createMember.isPending} fullWidth>
          Add Team Member
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
  input: {
    borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 16,
    backgroundColor: "#ffffff", color: "#111827",
  },
  inputError: { borderColor: "#ef4444" },
  error: { fontSize: 12, color: "#ef4444", marginTop: 4 },
  roleRow: { flexDirection: "row", gap: 8 },
  actions: { marginTop: 24, gap: 10 },
});
