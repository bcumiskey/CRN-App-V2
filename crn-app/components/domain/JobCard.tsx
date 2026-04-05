import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { StatusBadge } from "../ui/StatusBadge";
import { Card } from "../ui/Card";

interface JobCardProps {
  jobNumber: string;
  propertyName: string;
  scheduledDate: string;
  scheduledTime?: string | null;
  jobType: string;
  status: string;
  totalFee?: number;
  isBtoB?: boolean;
  crew?: Array<{ name: string; share?: number }>;
  onPress?: () => void;
  compact?: boolean;
  showFee?: boolean;
}

export function JobCard({
  jobNumber,
  propertyName,
  scheduledDate,
  scheduledTime,
  jobType,
  status,
  totalFee,
  isBtoB = false,
  crew = [],
  onPress,
  compact = false,
  showFee = true,
}: JobCardProps) {
  const shareLabel = (share: number) => {
    if (share === 1) return "Full";
    if (share === 0.75) return "3/4";
    if (share === 0.5) return "Half";
    if (share === 0) return "Off";
    return `${share}`;
  };

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} disabled={!onPress}>
      <Card style={styles.card}>
        {/* Top row: job number + date */}
        <View style={styles.topRow}>
          <Text style={styles.jobNumber}>{jobNumber}</Text>
          <View style={styles.dateRow}>
            {scheduledTime && <Text style={styles.time}>{scheduledTime}</Text>}
            {!compact && <Text style={styles.date}>{scheduledDate}</Text>}
          </View>
        </View>

        {/* Property name */}
        <Text style={styles.propertyName}>{propertyName}</Text>

        {/* Type + status row */}
        <View style={styles.statusRow}>
          <Text style={styles.jobType}>{jobType}</Text>
          <StatusBadge status={status} />
          {isBtoB && (
            <View style={styles.btobBadge}>
              <Text style={styles.btobText}>B2B</Text>
            </View>
          )}
        </View>

        {/* Crew */}
        {crew.length > 0 && (
          <View style={styles.crewRow}>
            {crew.map((c, i) => (
              <View key={i} style={styles.crewMember}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {c.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.crewName}>{c.name}</Text>
                {c.share !== undefined && (
                  <Text style={styles.shareText}>({shareLabel(c.share)})</Text>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Fee */}
        {showFee && totalFee !== undefined && (
          <Text style={styles.fee}>${totalFee.toFixed(2)}</Text>
        )}
      </Card>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 8 },
  topRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  jobNumber: { fontSize: 12, color: "#9ca3af" },
  dateRow: { flexDirection: "row", gap: 8 },
  time: { fontSize: 13, color: "#374151", fontWeight: "500" },
  date: { fontSize: 13, color: "#6b7280" },
  propertyName: { fontSize: 17, fontWeight: "600", color: "#111827", marginBottom: 6 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  jobType: { fontSize: 13, color: "#6b7280" },
  btobBadge: {
    backgroundColor: "#fff7ed",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  btobText: { fontSize: 11, fontWeight: "600", color: "#ea580c" },
  crewRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 6 },
  crewMember: { flexDirection: "row", alignItems: "center", gap: 4 },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#e5e7eb",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 11, fontWeight: "600", color: "#374151" },
  crewName: { fontSize: 13, color: "#374151" },
  shareText: { fontSize: 11, color: "#9ca3af" },
  fee: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    textAlign: "right",
    marginTop: 4,
  },
});
