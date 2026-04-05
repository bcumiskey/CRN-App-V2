/**
 * Design tokens matching V1's proven visual language.
 * Used in both NativeWind classes and programmatic styles.
 */

export const colors = {
  primary: {
    50: "#eff6ff",
    100: "#dbeafe",
    500: "#3b82f6",
    600: "#2563eb",
    700: "#1d4ed8",
  },
  gray: {
    50: "#f9fafb",
    100: "#f3f4f6",
    200: "#e5e7eb",
    300: "#d1d5db",
    400: "#9ca3af",
    500: "#6b7280",
    600: "#4b5563",
    700: "#374151",
    800: "#1f2937",
    900: "#111827",
  },
  green: {
    50: "#f0fdf4",
    500: "#22c55e",
    600: "#16a34a",
  },
  yellow: {
    50: "#fefce8",
    500: "#eab308",
    600: "#ca8a04",
  },
  red: {
    50: "#fef2f2",
    500: "#ef4444",
    600: "#dc2626",
  },
  orange: {
    50: "#fff7ed",
    500: "#f97316",
    600: "#ea580c",
  },
} as const;

export const statusColors: Record<string, { bg: string; text: string; dot: string }> = {
  SCHEDULED: { bg: "#dbeafe", text: "#2563eb", dot: "#3b82f6" },
  IN_PROGRESS: { bg: "#fefce8", text: "#ca8a04", dot: "#eab308" },
  COMPLETED: { bg: "#f0fdf4", text: "#16a34a", dot: "#22c55e" },
  INVOICED: { bg: "#f3f4f6", text: "#6b7280", dot: "#9ca3af" },
  CANCELLED: { bg: "#fef2f2", text: "#dc2626", dot: "#ef4444" },
  // Invoice statuses
  draft: { bg: "#f3f4f6", text: "#6b7280", dot: "#9ca3af" },
  sent: { bg: "#dbeafe", text: "#2563eb", dot: "#3b82f6" },
  paid: { bg: "#f0fdf4", text: "#16a34a", dot: "#22c55e" },
  overdue: { bg: "#fff7ed", text: "#ea580c", dot: "#f97316" },
  void: { bg: "#fef2f2", text: "#dc2626", dot: "#ef4444" },
  // Pay period statuses
  open: { bg: "#dbeafe", text: "#2563eb", dot: "#3b82f6" },
  closed: { bg: "#fefce8", text: "#ca8a04", dot: "#eab308" },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;
