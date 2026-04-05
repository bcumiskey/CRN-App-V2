import { View, Text, StyleSheet } from "react-native";
import { statusColors } from "../../constants/theme";

interface StatusBadgeProps {
  status: string;
  size?: "sm" | "md";
}

const labels: Record<string, string> = {
  SCHEDULED: "Scheduled",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  INVOICED: "Invoiced",
  CANCELLED: "Cancelled",
  active: "Active",
  lame_duck: "Lame Duck",
  archived: "Archived",
  draft: "Draft",
  sent: "Sent",
  paid: "Paid",
  overdue: "Overdue",
  void: "Void",
  open: "Open",
  closed: "Closed",
  ONE_TIME: "One-Time",
  RECURRING: "Recurring",
  MONTHLY: "Monthly",
};

export function StatusBadge({ status, size = "sm" }: StatusBadgeProps) {
  const colors = statusColors[status] ?? statusColors.SCHEDULED;
  const label = labels[status] ?? status;
  const isSmall = size === "sm";

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: colors.bg },
        isSmall ? styles.sm : styles.md,
      ]}
    >
      <View style={[styles.dot, { backgroundColor: colors.dot }]} />
      <Text
        style={[
          styles.text,
          { color: colors.text },
          isSmall ? styles.textSm : styles.textMd,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 999,
  },
  sm: { paddingHorizontal: 8, paddingVertical: 2 },
  md: { paddingHorizontal: 10, paddingVertical: 4 },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  text: { fontWeight: "600" },
  textSm: { fontSize: 11 },
  textMd: { fontSize: 13 },
});
