import { View, Text, ScrollView, StyleSheet } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useTeamMember } from "../../../../hooks/use-team";
import { useSettings } from "../../../../hooks/use-settings";
import { Card } from "../../../../components/ui/Card";
import { StatusBadge } from "../../../../components/ui/StatusBadge";
import { calculateJob } from "crn-shared";
import type { FinancialModel } from "crn-shared";

export default function TeamMemberDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const memberQuery = useTeamMember(id);
  const settingsQuery = useSettings();

  const member = memberQuery.data;
  const settings = settingsQuery.data;

  if (!member) {
    return <View style={styles.loading}><Text>Loading...</Text></View>;
  }

  const shareLabel = (s: number) =>
    s === 1 ? "Full" : s === 0.75 ? "3/4" : s === 0.5 ? "Half" : s === 0 ? "Off" : `${s}`;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Profile Header */}
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{member.name.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.name}>{member.name}</Text>
          <Text style={styles.role}>
            {member.role === "admin" ? "Admin" : "Worker"}
            {member.isOwner ? " • Owner" : ""}
          </Text>
          <StatusBadge status={member.status} size="md" />
        </View>
      </View>

      {/* Contact */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Contact</Text>
        <InfoRow label="Email" value={member.email} />
        {member.phone && <InfoRow label="Phone" value={member.phone} />}
      </Card>

      {/* Details */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Details</Text>
        <InfoRow label="Default Share" value={shareLabel(member.defaultShare)} />
        <InfoRow label="Status" value={member.status} />
        {member.statusChangedAt && (
          <InfoRow label="Status Changed" value={member.statusChangedAt} />
        )}
        {member.statusReason && (
          <InfoRow label="Reason" value={member.statusReason} />
        )}
      </Card>

      {/* Stats */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Stats</Text>
        <InfoRow label="Total Jobs" value={String(member.totalJobs ?? 0)} />
      </Card>

      {/* Recent Assignments */}
      {member.recentAssignments && member.recentAssignments.length > 0 && (
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Jobs</Text>
          {member.recentAssignments.map((a) => (
            <View key={a.id} style={styles.assignmentRow}>
              <View style={styles.assignmentInfo}>
                <Text style={styles.assignmentProperty}>{a.job.property.name}</Text>
                <Text style={styles.assignmentDate}>{a.job.scheduledDate}</Text>
              </View>
              <Text style={styles.assignmentShare}>{shareLabel(a.share)}</Text>
              <StatusBadge status={a.job.status} />
            </View>
          ))}
        </Card>
      )}
    </ScrollView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  content: { padding: 16, paddingBottom: 40 },
  loading: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  avatar: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: "#dbeafe",
    alignItems: "center", justifyContent: "center", marginRight: 16,
  },
  avatarText: { fontSize: 26, fontWeight: "700", color: "#2563eb" },
  headerInfo: { flex: 1 },
  name: { fontSize: 22, fontWeight: "700", color: "#111827" },
  role: { fontSize: 14, color: "#6b7280", marginBottom: 4 },
  section: { marginBottom: 12 },
  sectionTitle: { fontSize: 13, fontWeight: "600", color: "#6b7280", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 },
  infoRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  infoLabel: { fontSize: 14, color: "#6b7280" },
  infoValue: { fontSize: 14, color: "#111827", fontWeight: "500" },
  assignmentRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#f3f4f6", gap: 8 },
  assignmentInfo: { flex: 1 },
  assignmentProperty: { fontSize: 14, fontWeight: "500", color: "#111827" },
  assignmentDate: { fontSize: 12, color: "#9ca3af" },
  assignmentShare: { fontSize: 13, color: "#6b7280" },
});
