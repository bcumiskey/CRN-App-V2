import { View, Text, TouchableOpacity, StyleSheet } from "react-native";

interface SharePillsProps {
  value: number;
  onChange: (share: number) => void;
  shareLevels?: Array<{ label: string; value: number }>;
}

const defaultLevels = [
  { label: "Full", value: 1.0 },
  { label: "3/4", value: 0.75 },
  { label: "Half", value: 0.5 },
  { label: "Off", value: 0 },
];

export function SharePills({
  value,
  onChange,
  shareLevels = defaultLevels,
}: SharePillsProps) {
  return (
    <View style={styles.container}>
      {shareLevels.map((level) => {
        const isActive = Math.abs(value - level.value) < 0.001;
        return (
          <TouchableOpacity
            key={level.label}
            onPress={() => onChange(level.value)}
            style={[styles.pill, isActive && styles.pillActive]}
            activeOpacity={0.7}
          >
            <Text style={[styles.pillText, isActive && styles.pillTextActive]}>
              {level.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: "row", gap: 6 },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#f3f4f6",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  pillActive: {
    backgroundColor: "#dbeafe",
    borderColor: "#3b82f6",
  },
  pillText: { fontSize: 13, fontWeight: "500", color: "#6b7280" },
  pillTextActive: { color: "#2563eb" },
});
