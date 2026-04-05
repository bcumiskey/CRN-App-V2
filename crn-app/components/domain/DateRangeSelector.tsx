import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useState } from "react";

interface DateRangeSelectorProps {
  onSelect: (params: { preset?: string; startDate?: string; endDate?: string }) => void;
  currentPreset?: string;
}

const presets = [
  { key: "this_month", label: "This Month" },
  { key: "last_month", label: "Last Month" },
  { key: "this_quarter", label: "Quarter" },
  { key: "ytd", label: "YTD" },
  { key: "this_year", label: "Year" },
];

export function DateRangeSelector({ onSelect, currentPreset = "this_month" }: DateRangeSelectorProps) {
  const [selected, setSelected] = useState(currentPreset);

  const handleSelect = (key: string) => {
    setSelected(key);
    onSelect({ preset: key });
  };

  return (
    <View style={styles.container}>
      {presets.map((preset) => (
        <TouchableOpacity
          key={preset.key}
          onPress={() => handleSelect(preset.key)}
          style={[styles.pill, selected === preset.key && styles.pillActive]}
        >
          <Text style={[styles.text, selected === preset.key && styles.textActive]}>
            {preset.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: "row", gap: 6, paddingVertical: 8 },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#f3f4f6",
  },
  pillActive: { backgroundColor: "#dbeafe" },
  text: { fontSize: 13, fontWeight: "500", color: "#6b7280" },
  textActive: { color: "#2563eb" },
});
