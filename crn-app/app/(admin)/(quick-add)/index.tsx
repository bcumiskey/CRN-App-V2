import { View, Text, ScrollView, TextInput, Switch, StyleSheet, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useProperties } from "../../../hooks/use-properties";
import { useActiveTeam } from "../../../hooks/use-team";
import { useSettings } from "../../../hooks/use-settings";
import { useCreateJob } from "../../../hooks/use-jobs";
import { Button } from "../../../components/ui/Button";
import { CurrencyInput } from "../../../components/ui/CurrencyInput";
import { SharePills } from "../../../components/domain/SharePills";

const jobTypes = ["STANDARD", "DEEP", "TURNOVER", "INSPECTION", "LAUNDRY", "OTHER"];

export default function QuickAddScreen() {
  const router = useRouter();
  const propertiesQuery = useProperties({ status: "active" });
  const teamQuery = useActiveTeam();
  const settingsQuery = useSettings();
  const createJob = useCreateJob();

  const properties = propertiesQuery.data ?? [];
  const team = teamQuery.data ?? [];
  const shareLevels = settingsQuery.data?.financialModel?.shareLevels;

  // Form state
  const [propertyId, setPropertyId] = useState("");
  const [scheduledDate, setScheduledDate] = useState(() => {
    const d = new Date();
    return d.toISOString().split("T")[0];
  });
  const [scheduledTime, setScheduledTime] = useState("");
  const [jobType, setJobType] = useState("STANDARD");
  const [jobTypeLabel, setJobTypeLabel] = useState("");
  const [totalFee, setTotalFee] = useState<number | undefined>();
  const [houseCutPercent, setHouseCutPercent] = useState<number | undefined>();
  const [isBtoB, setIsBtoB] = useState(false);
  const [notes, setNotes] = useState("");
  const [assignments, setAssignments] = useState<Array<{ userId: string; share: number }>>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const selectedProperty = properties.find((p) => p.id === propertyId);

  const handlePropertySelect = (id: string) => {
    setPropertyId(id);
    const prop = properties.find((p) => p.id === id);
    if (prop) {
      if (prop.defaultJobFee) setTotalFee(prop.defaultJobFee);
      setHouseCutPercent(prop.houseCutPercent);
    }
  };

  const toggleCrewMember = (userId: string) => {
    const existing = assignments.find((a) => a.userId === userId);
    if (existing) {
      setAssignments(assignments.filter((a) => a.userId !== userId));
    } else {
      const member = team.find((m) => m.id === userId);
      setAssignments([...assignments, { userId, share: member?.defaultShare ?? 1.0 }]);
    }
  };

  const updateShare = (userId: string, share: number) => {
    setAssignments(assignments.map((a) => (a.userId === userId ? { ...a, share } : a)));
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!propertyId) errs.propertyId = "Property is required";
    if (!scheduledDate) errs.scheduledDate = "Date is required";
    if (totalFee === undefined || totalFee < 0) errs.totalFee = "Fee is required";
    if (houseCutPercent === undefined) errs.houseCutPercent = "House cut is required";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async (addAnother: boolean) => {
    if (!validate()) return;
    try {
      await createJob.mutateAsync({
        propertyId,
        scheduledDate,
        scheduledTime: scheduledTime || undefined,
        jobType,
        jobTypeLabel: jobType === "OTHER" ? jobTypeLabel : undefined,
        totalFee: totalFee!,
        houseCutPercent: houseCutPercent!,
        isBtoB,
        notes: notes || undefined,
        assignments: assignments.length > 0 ? assignments : undefined,
      });

      if (addAnother) {
        // Reset form but keep date
        setPropertyId("");
        setTotalFee(undefined);
        setHouseCutPercent(undefined);
        setJobType("STANDARD");
        setNotes("");
        setAssignments([]);
        setIsBtoB(false);
        Alert.alert("Job Created", "Job saved. Add another?");
      } else {
        router.back();
      }
    } catch {
      Alert.alert("Error", "Failed to create job. Please try again.");
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>New Job</Text>

      {/* Property */}
      <Text style={styles.label}>Property *</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillScroll}>
        {properties.map((p) => (
          <Button
            key={p.id}
            variant={propertyId === p.id ? "primary" : "outline"}
            size="sm"
            onPress={() => handlePropertySelect(p.id)}
          >
            {p.name}
          </Button>
        ))}
      </ScrollView>
      {errors.propertyId && <Text style={styles.error}>{errors.propertyId}</Text>}

      {/* Date */}
      <Text style={styles.label}>Date *</Text>
      <TextInput
        style={styles.input}
        value={scheduledDate}
        onChangeText={setScheduledDate}
        placeholder="YYYY-MM-DD"
      />

      {/* Time */}
      <Text style={styles.label}>Time (optional)</Text>
      <TextInput
        style={styles.input}
        value={scheduledTime}
        onChangeText={setScheduledTime}
        placeholder="09:00"
      />

      {/* Job Type */}
      <Text style={styles.label}>Job Type *</Text>
      <View style={styles.typeRow}>
        {jobTypes.map((type) => (
          <Button
            key={type}
            variant={jobType === type ? "primary" : "outline"}
            size="sm"
            onPress={() => setJobType(type)}
          >
            {type}
          </Button>
        ))}
      </View>
      {jobType === "OTHER" && (
        <TextInput
          style={[styles.input, { marginTop: 8 }]}
          value={jobTypeLabel}
          onChangeText={setJobTypeLabel}
          placeholder="Custom job type label"
        />
      )}

      {/* Fee */}
      <CurrencyInput
        label="Job Fee *"
        value={totalFee}
        onChangeValue={setTotalFee}
        error={errors.totalFee}
        autoFilled={!!selectedProperty?.defaultJobFee}
      />

      {/* House Cut */}
      <Text style={styles.label}>House Cut % *</Text>
      <TextInput
        style={[styles.input, errors.houseCutPercent ? styles.inputError : null]}
        value={houseCutPercent !== undefined ? String(houseCutPercent) : ""}
        onChangeText={(v) => setHouseCutPercent(parseFloat(v) || 0)}
        keyboardType="decimal-pad"
        placeholder="0"
      />

      {/* B2B Toggle */}
      <View style={styles.toggleRow}>
        <Text style={styles.label}>Back-to-back turnover</Text>
        <Switch value={isBtoB} onValueChange={setIsBtoB} />
      </View>

      {/* Crew */}
      <Text style={styles.label}>Crew & Shares</Text>
      {team.map((member) => {
        const assignment = assignments.find((a) => a.userId === member.id);
        return (
          <View key={member.id} style={styles.crewMember}>
            <Button
              variant={assignment ? "primary" : "outline"}
              size="sm"
              onPress={() => toggleCrewMember(member.id)}
            >
              {member.name}
            </Button>
            {assignment && (
              <SharePills
                value={assignment.share}
                onChange={(share) => updateShare(member.id, share)}
                shareLevels={shareLevels}
              />
            )}
          </View>
        );
      })}

      {/* Notes */}
      <Text style={styles.label}>Notes</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={notes}
        onChangeText={setNotes}
        placeholder="Special instructions, guest notes..."
        multiline
        numberOfLines={3}
      />

      {/* Actions */}
      <View style={styles.actions}>
        <Button
          variant="primary"
          onPress={() => handleSave(false)}
          loading={createJob.isPending}
          fullWidth
        >
          Save & Done
        </Button>
        <Button
          variant="outline"
          onPress={() => handleSave(true)}
          loading={createJob.isPending}
          fullWidth
        >
          Save & Add Another
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
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: "#ffffff",
    color: "#111827",
  },
  inputError: { borderColor: "#ef4444" },
  textArea: { minHeight: 80, textAlignVertical: "top" },
  error: { fontSize: 12, color: "#ef4444", marginTop: 4 },
  pillScroll: { flexDirection: "row", gap: 8 },
  typeRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  toggleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 12 },
  crewMember: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 8 },
  actions: { marginTop: 24, gap: 10 },
});
