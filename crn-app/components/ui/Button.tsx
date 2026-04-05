import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from "react-native";
import { ReactNode } from "react";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "success";
type Size = "sm" | "md" | "lg";

interface ButtonProps {
  onPress: () => void;
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
}

export function Button({
  onPress,
  children,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  fullWidth = false,
  style,
}: ButtonProps) {
  const variantStyles = variants[variant];
  const sizeStyles = sizes[size];

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.base,
        variantStyles.container,
        sizeStyles.container,
        fullWidth && styles.fullWidth,
        (disabled || loading) && styles.disabled,
        style,
      ]}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variantStyles.text.color as string}
        />
      ) : typeof children === "string" ? (
        <Text style={[styles.text, variantStyles.text, sizeStyles.text]}>
          {children}
        </Text>
      ) : (
        children
      )}
    </TouchableOpacity>
  );
}

const variants: Record<Variant, { container: ViewStyle; text: TextStyle }> = {
  primary: {
    container: { backgroundColor: "#2563eb" },
    text: { color: "#ffffff" },
  },
  secondary: {
    container: { backgroundColor: "#f3f4f6" },
    text: { color: "#374151" },
  },
  outline: {
    container: { backgroundColor: "transparent", borderWidth: 1, borderColor: "#d1d5db" },
    text: { color: "#374151" },
  },
  ghost: {
    container: { backgroundColor: "transparent" },
    text: { color: "#2563eb" },
  },
  danger: {
    container: { backgroundColor: "#dc2626" },
    text: { color: "#ffffff" },
  },
  success: {
    container: { backgroundColor: "#16a34a" },
    text: { color: "#ffffff" },
  },
};

const sizes: Record<Size, { container: ViewStyle; text: TextStyle }> = {
  sm: { container: { paddingHorizontal: 12, paddingVertical: 6 }, text: { fontSize: 13 } },
  md: { container: { paddingHorizontal: 16, paddingVertical: 10 }, text: { fontSize: 15 } },
  lg: { container: { paddingHorizontal: 20, paddingVertical: 14 }, text: { fontSize: 17 } },
};

const styles = StyleSheet.create({
  base: {
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  fullWidth: { width: "100%" },
  disabled: { opacity: 0.5 },
  text: { fontWeight: "600" },
});
