import { View, Text, ScrollView, TouchableOpacity, Linking, StyleSheet, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useWorkerJob, useWorkerUpdateJobStatus } from "../../../hooks/use-worker";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { StatusBadge } from "../../../components/ui/StatusBadge";

export default function WorkerJobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const jobQuery = useWorkerJob(id);
  const updateStatus = useWorkerUpdateJobStatus();

  const job = jobQuery.data;

  if (!job) {
    return <View style={styles.loading}><Text>Loading...</Text></View>;
  }

  const handleStatusChange = (newStatus: string) => {
    const label = newStatus === "IN_PROGRESS" ? "Start" : "Complete";
    Alert.alert(`${label} Job`, `Mark this job as ${label.toLowerCase()}d?`, [
      { text: "Cancel", style: "cancel" },
      { text: label, onPress: () => updateStatus.mutate({ id: job.id, status: newStatus }) },
    ]);
  };

  const primaryAction = job.status === "SCHEDULED" ? "IN_PROGRESS"
    : job.status === "IN_PROGRESS" ? "COMPLETED" : null;
  const primaryLabel = primaryAction === "IN_PROGRESS" ? "Start Job"
    : primaryAction === "COMPLETED" ? "Complete Job" : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <StatusBadge status={job.status} size="md" />
        {job.isBtoB && (
          <View style={styles.btob}><Text style={styles.btobText}>B2B</Text></View>
        )}
      </View>

      {/* Property */}
      <Text style={styles.propertyName}>{job.property.name}</Text>
      <Text style={styles.dateTime}>
        {job.scheduledDate}{job.scheduledTime ? ` at ${job.scheduledTime}` : ""} • {job.jobType}
      </Text>

      {/* Getting There */}
      {(job.property.address || job.property.parkingNotes) && (
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Getting There</Text>
          {job.property.address && (
            <TouchableOpacity onPress={() => Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(job.property.address!)}`)}>
              <Text style={styles.link}>{job.property.address}</Text>
            </TouchableOpacity>
          )}
          {job.property.parkingNotes && <Text style={styles.infoText}>Parking: {job.property.parkingNotes}</Text>}
        </Card>
      )}

      {/* Getting In */}
      {(job.property.accessInstructions || job.property.wifiName) && (
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Getting In</Text>
          {job.property.accessInstructions && (
            <Text style={styles.accessCode}>{job.property.accessInstructions}</Text>
          )}
          {job.property.wifiName && (
            <Text style={styles.infoText}>
              WiFi: {job.property.wifiName}{job.property.wifiPassword ? ` / ${job.property.wifiPassword}` : ""}
            </Text>
          )}
        </Card>
      )}

      {/* Crew — names only */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Your Team</Text>
        {job.assignments.map((a, i) => (
          <Text key={i} style={styles.crewName}>{a.userName}</Text>
        ))}
      </Card>

      {/* Notes (read-only) */}
      {job.notes && (
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Job Notes</Text>
          <Text style={styles.infoText}>{job.notes}</Text>
        </Card>
      )}

      {/* NO FINANCIAL DATA — no fee, no house cut, no buckets, no pay amounts */}

      {/* Actions */}
      <View style={styles.actionBar}>
        {primaryAction && primaryLabel && (
          <Button
            variant="success"
            size="lg"
            fullWidth
            loading={updateStatus.isPending}
            onPress={() => handleStatusChange(primaryAction)}
          >
            {primaryLabel}
          </Button>
        )}
        <Button
          variant="outline"
          size="md"
          fullWidth
          onPress={() => router.push(`/(worker)/properties/${job.propertyId}`)}
        >
          View Property Reference
        </Button>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  content: { padding: 16, paddingBottom: 40 },
  loading: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { flexDirection: "row", gap: 8, marginBottom: 8 },
  btob: { backgroundColor: "#fff7ed", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  btobText: { fontSize: 12, fontWeight: "600", color: "#ea580c" },
  propertyName: { fontSize: 24, fontWeight: "700", color: "#111827" },
  dateTime: { fontSize: 15, color: "#6b7280", marginBottom: 16 },
  section: { marginBottom: 12 },
  sectionTitle: { fontSize: 13, fontWeight: "600", color: "#6b7280", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 },
  link: { fontSize: 15, color: "#2563eb", textDecorationLine: "underline" },
  accessCode: { fontSize: 18, fontWeight: "700", color: "#111827", backgroundColor: "#f0fdf4", padding: 12, borderRadius: 8, textAlign: "center", marginBottom: 8 },
  infoText: { fontSize: 14, color: "#374151", lineHeight: 20, marginTop: 4 },
  crewName: { fontSize: 15, color: "#374151", paddingVertical: 4 },
  actionBar: { marginTop: 20, gap: 10 },
});
