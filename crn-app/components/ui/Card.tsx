import { View, StyleSheet, ViewStyle } from "react-native";
import { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  style?: ViewStyle;
  padding?: "none" | "sm" | "md" | "lg";
}

export function Card({ children, style, padding = "md" }: CardProps) {
  return (
    <View style={[styles.card, paddings[padding], style]}>
      {children}
    </View>
  );
}

const paddings: Record<string, ViewStyle> = {
  none: {},
  sm: { padding: 12 },
  md: { padding: 16 },
  lg: { padding: 20 },
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
});
