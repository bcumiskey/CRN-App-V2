import { View, Text, ScrollView, TouchableOpacity, Switch, TextInput, Alert, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
  useJob,
  useUpdateJob,
  useUpdateJobStatus,
  useAddAssignment,
  useRemoveAssignment,
  useUpdateAssignment,
  useAddCharge,
  useRemoveCharge,
} from "../../../../hooks/use-jobs";
import { useActiveTeam } from "../../../../hooks/use-team";
import { useSettings } from "../../../../hooks/use-settings";
import { Card } from "../../../../components/ui/Card";
import { Button } from "../../../../components/ui/Button";
import { StatusBadge } from "../../../../components/ui/StatusBadge";
import { SharePills } from "../../../../components/domain/SharePills";
import { FinancialSummary } from "../../../../components/domain/FinancialSummary";

const statusTransitions: Record<string, string[]> = {
  SCHEDULED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: ["CANCELLED"],
  CANCELLED: ["SCHEDULED"],
};

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const jobQuery = useJob(id);
  const teamQuery = useActiveTeam();
  const settingsQuery = useSettings();
  const updateStatus = useUpdateJobStatus();
  const updateJob = useUpdateJob();
  const addAssignment = useAddAssignment();
  const removeAssignment = useRemoveAssignment();
  const updateAssignment = useUpdateAssignment();
  const addCharge = useAddCharge();
  const removeCharge = useRemoveCharge();

  const [showCrewPicker, setShowCrewPicker] = useState(false);
  const [chargeAmount, setChargeAmount] = useState("");
  const [chargeReason, setChargeReason] = useState("");
  const [showChargeForm, setShowChargeForm] = useState(false);

  const job = jobQuery.data;
  const team = teamQuery.data ?? [];
  const settings = settingsQuery.data;

  if (!job) {
    return <View style={styles.loading}><Text>Loading...</Text></View>;
  }

  const allowedTransitions = statusTransitions[job.status] ?? [];
  const primaryAction = job.status === "SCHEDULED" ? "IN_PROGRESS"
    : job.status === "IN_PROGRESS" ? "COMPLETED"
    : null;

  const primaryActionLabel = primaryAction === "IN_PROGRESS" ? "Start Job"
    : primaryAction === "COMPLETED" ? "Complete Job"
    : null;

  const handleStatusChange = (newStatus: string) => {
    const label = newStatus.replace("_", " ").toLowerCase();
    Alert.alert(
      `Change Status`,
      `Mark this job as ${label}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: () => updateStatus.mutate({ id: job.id, status: newStatus }),
        },
      ]
    );
  };

  const handleAddCrew = (userId: string) => {
    const member = team.find((m) => m.id === userId);
    addAssignment.mutate({
      jobId: job.id,
      userId,
      share: member?.defaultShare ?? 1.0,
    });
    setShowCrewPicker(false);
  };

  const handleAddCharge = () => {
    const amount = parseFloat(chargeAmount);
    if (isNaN(amount) || amount <= 0 || !chargeReason.trim()) {
      Alert.alert("Error", "Enter a valid amount and reason.");
      return;
    }
    addCharge.mutate({ jobId: job.id, amount, reason: chargeReason.trim() });
    setChargeAmount("");
    setChargeReason("");
    setShowChargeForm(false);
  };

  const assignedUserIds = new Set(job.assignments.map((a) => a.userId));
  const availableCrew = team.filter((m) => !assignedUserIds.has(m.id));

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.jobNumber}>{job.jobNumber}</Text>
        <StatusBadge status={job.status} size="md" />
      </View>

      {/* Property & Schedule */}
      <Card style={styles.section}>
        <Text style={styles.propertyName}>{job.property.name}</Text>
        {job.property.address && <Text style={styles.address}>{job.property.address}</Text>}
        <View style={styles.detailRow}>
          <Text style={styles.detail}>{job.scheduledDate}</Text>
          {job.scheduledTime && <Text style={styles.detail}>{job.scheduledTime}</Text>}
          <Text style={styles.detail}>{job.jobType}</Text>
          {job.isBtoB && <Text style={styles.btob}>B2B</Text>}
        </View>
      </Card>

      {/* Crew & Shares */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Crew & Shares</Text>
        {job.assignments.map((assignment) => (
          <View key={assignment.id} style={styles.crewRow}>
            <View style={styles.crewInfo}>
              <Text style={styles.crewName}>
                {assignment.user.name}
                {assignment.user.isOwner && " 👑"}
              </Text>
            </View>
            <SharePills
              value={assignment.share}
              onChange={(share) =>
                updateAssignment.mutate({
                  jobId: job.id,
                  assignmentId: assignment.id,
                  share,
                })
              }
              shareLevels={settings?.financialModel?.shareLevels}
            />
            <TouchableOpacity
              onPress={() =>
                Alert.alert("Remove", `Remove ${assignment.user.name}?`, [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Remove",
                    style: "destructive",
                    onPress: () =>
                      removeAssignment.mutate({
                        jobId: job.id,
                        assignmentId: assignment.id,
                      }),
                  },
                ])
              }
              style={styles.removeBtn}
            >
              <Text style={styles.removeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}

        {showCrewPicker ? (
          <View style={styles.pickerList}>
            {availableCrew.map((member) => (
              <TouchableOpacity
                key={member.id}
                onPress={() => handleAddCrew(member.id)}
                style={styles.pickerItem}
              >
                <Text style={styles.pickerItemText}>{member.name}</Text>
              </TouchableOpacity>
            ))}
            <Button variant="ghost" size="sm" onPress={() => setShowCrewPicker(false)}>
              Cancel
            </Button>
          </View>
        ) : (
          <Button variant="outline" size="sm" onPress={() => setShowCrewPicker(true)}>
            + Add Crew
          </Button>
        )}
      </Card>

      {/* Financial Summary */}
      {settings && (
        <FinancialSummary
          financialModel={settings.financialModel}
          totalFee={job.totalFee}
          houseCutPercent={job.houseCutPercent}
          charges={job.charges.map((c) => ({ amount: c.amount, reason: c.reason }))}
          assignments={job.assignments.map((a) => ({
            userId: a.user.id,
            userName: a.user.name,
            share: a.share,
            isOwner: a.user.isOwner,
          }))}
        />
      )}

      {/* Extra Charges */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Extra Charges</Text>
        {job.charges.map((charge) => (
          <View key={charge.id} style={styles.chargeRow}>
            <Text style={styles.chargeReason}>{charge.reason}</Text>
            <Text style={styles.chargeAmount}>${charge.amount.toFixed(2)}</Text>
            <TouchableOpacity
              onPress={() =>
                removeCharge.mutate({ jobId: job.id, chargeId: charge.id })
              }
            >
              <Text style={styles.removeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}

        {showChargeForm ? (
          <View style={styles.chargeForm}>
            <TextInput
              style={styles.input}
              value={chargeAmount}
              onChangeText={setChargeAmount}
              placeholder="Amount"
              keyboardType="decimal-pad"
            />
            <TextInput
              style={styles.input}
              value={chargeReason}
              onChangeText={setChargeReason}
              placeholder="Reason"
              maxLength={120}
            />
            <View style={styles.chargeActions}>
              <Button variant="primary" size="sm" onPress={handleAddCharge}>
                Add
              </Button>
              <Button variant="ghost" size="sm" onPress={() => setShowChargeForm(false)}>
                Cancel
              </Button>
            </View>
          </View>
        ) : (
          <Button variant="outline" size="sm" onPress={() => setShowChargeForm(true)}>
            + Add Charge
          </Button>
        )}
      </Card>

      {/* Notes */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Notes</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={job.notes ?? ""}
          onChangeText={(text) => updateJob.mutate({ id: job.id, notes: text })}
          placeholder="Job notes..."
          multiline
          numberOfLines={3}
        />
      </Card>

      {/* Payment Status */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Payment Status</Text>
        <View style={styles.paymentRow}>
          <Text style={styles.paymentLabel}>Client Paid</Text>
          <Switch
            value={job.clientPaid}
            onValueChange={(val) =>
              updateJob.mutate({
                id: job.id,
                clientPaid: val,
                clientPaidDate: val ? new Date().toISOString().split("T")[0] : null,
              })
            }
          />
        </View>
        <View style={styles.paymentRow}>
          <Text style={styles.paymentLabel}>Team Paid</Text>
          <Switch
            value={job.teamPaid}
            onValueChange={(val) =>
              updateJob.mutate({
                id: job.id,
                teamPaid: val,
                teamPaidDate: val ? new Date().toISOString().split("T")[0] : null,
              })
            }
          />
        </View>
      </Card>

      {/* Action Bar */}
      <View style={styles.actionBar}>
        {primaryAction && primaryActionLabel && (
          <Button
            variant="success"
            size="lg"
            fullWidth
            loading={updateStatus.isPending}
            onPress={() => handleStatusChange(primaryAction)}
          >
            {primaryActionLabel}
          </Button>
        )}
        {allowedTransitions.includes("CANCELLED") && job.status !== "CANCELLED" && (
          <Button
            variant="danger"
            size="sm"
            fullWidth
            onPress={() => handleStatusChange("CANCELLED")}
          >
            Cancel Job
          </Button>
        )}
        {job.status === "CANCELLED" && (
          <Button
            variant="outline"
            size="md"
            fullWidth
            onPress={() => handleStatusChange("SCHEDULED")}
          >
            Reschedule
          </Button>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  content: { padding: 16, paddingBottom: 40 },
  loading: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  jobNumber: { fontSize: 14, color: "#9ca3af", fontWeight: "500" },
  section: { marginBottom: 12 },
  sectionTitle: { fontSize: 13, fontWeight: "600", color: "#6b7280", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 },
  propertyName: { fontSize: 22, fontWeight: "700", color: "#111827" },
  address: { fontSize: 14, color: "#6b7280", marginTop: 2 },
  detailRow: { flexDirection: "row", gap: 12, marginTop: 8 },
  detail: { fontSize: 14, color: "#374151" },
  btob: { fontSize: 12, fontWeight: "600", color: "#ea580c", backgroundColor: "#fff7ed", paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
  crewRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  crewInfo: { minWidth: 80 },
  crewName: { fontSize: 14, fontWeight: "500", color: "#111827" },
  removeBtn: { padding: 4 },
  removeBtnText: { fontSize: 14, color: "#9ca3af" },
  pickerList: { marginTop: 8, gap: 4 },
  pickerItem: { paddingVertical: 10, paddingHorizontal: 12, backgroundColor: "#f9fafb", borderRadius: 8 },
  pickerItemText: { fontSize: 15, color: "#111827" },
  chargeRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6 },
  chargeReason: { flex: 1, fontSize: 14, color: "#374151" },
  chargeAmount: { fontSize: 14, fontWeight: "500", color: "#111827" },
  chargeForm: { marginTop: 8, gap: 8 },
  chargeActions: { flexDirection: "row", gap: 8 },
  input: {
    borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 15,
    backgroundColor: "#ffffff", color: "#111827",
  },
  textArea: { minHeight: 80, textAlignVertical: "top" },
  paymentRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8 },
  paymentLabel: { fontSize: 15, color: "#374151" },
  actionBar: { marginTop: 16, gap: 10 },
});
