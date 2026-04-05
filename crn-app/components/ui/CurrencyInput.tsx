import { View, Text, TextInput, StyleSheet } from "react-native";
import { useState } from "react";

interface CurrencyInputProps {
  label?: string;
  value: number | undefined;
  onChangeValue: (value: number) => void;
  placeholder?: string;
  error?: string;
  autoFilled?: boolean;
}

export function CurrencyInput({
  label,
  value,
  onChangeValue,
  placeholder = "0.00",
  error,
  autoFilled = false,
}: CurrencyInputProps) {
  const [text, setText] = useState(value !== undefined ? value.toFixed(2) : "");

  const handleChange = (input: string) => {
    // Allow only numbers and one decimal point
    const cleaned = input.replace(/[^0-9.]/g, "");
    const parts = cleaned.split(".");
    const formatted = parts.length > 2
      ? parts[0] + "." + parts.slice(1).join("")
      : cleaned;

    setText(formatted);
    const num = parseFloat(formatted);
    if (!isNaN(num)) {
      onChangeValue(num);
    }
  };

  return (
    <View style={styles.container}>
      {label && (
        <View style={styles.labelRow}>
          <Text style={styles.label}>{label}</Text>
          {autoFilled && (
            <Text style={styles.autoFilled}>auto-filled</Text>
          )}
        </View>
      )}
      <View style={[styles.inputRow, error ? styles.inputError : null]}>
        <Text style={styles.prefix}>$</Text>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={handleChange}
          placeholder={placeholder}
          keyboardType="decimal-pad"
          placeholderTextColor="#9ca3af"
        />
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  labelRow: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  label: { fontSize: 14, fontWeight: "500", color: "#374151" },
  autoFilled: { fontSize: 11, color: "#3b82f6", marginLeft: 8, fontStyle: "italic" },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
  },
  inputError: { borderColor: "#ef4444" },
  prefix: { fontSize: 16, color: "#6b7280", marginRight: 4 },
  input: { flex: 1, fontSize: 16, paddingVertical: 10, color: "#111827" },
  error: { fontSize: 12, color: "#ef4444", marginTop: 4 },
});
