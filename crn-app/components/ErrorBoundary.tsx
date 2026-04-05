import React, { ReactNode } from "react";
import { View, Text, StyleSheet, Linking, Platform } from "react-native";
import { Button } from "./ui/Button";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // TODO: Log to error reporting service (e.g. Sentry)
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  handleReport = () => {
    const subject = encodeURIComponent("CRN App Error Report");
    const body = encodeURIComponent(
      `Error: ${this.state.error?.message ?? "Unknown error"}\n\n` +
        `Stack: ${this.state.error?.stack ?? "N/A"}\n\n` +
        `Please describe what you were doing when this happened:\n`
    );
    Linking.openURL(`mailto:support@cleanrightnow.com?subject=${subject}&body=${body}`);
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <View style={styles.card}>
            <Text style={styles.emoji}>!</Text>
            <Text style={styles.title}>Something went wrong</Text>
            <Text style={styles.message}>
              An unexpected error occurred. You can try again or report this issue to our support team.
            </Text>

            {__DEV__ && this.state.error && (
              <View style={styles.debugBox}>
                <Text style={styles.debugText} numberOfLines={4}>
                  {this.state.error.message}
                </Text>
              </View>
            )}

            <View style={styles.actions}>
              <Button variant="primary" size="lg" fullWidth onPress={this.handleReset}>
                Try Again
              </Button>
              <View style={{ height: 10 }} />
              <Button variant="outline" size="md" fullWidth onPress={this.handleReport}>
                Report Issue
              </Button>
            </View>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 32,
    width: "100%",
    maxWidth: 400,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  emoji: {
    fontSize: 40,
    fontWeight: "700",
    color: "#dc2626",
    width: 64,
    height: 64,
    lineHeight: 64,
    textAlign: "center",
    backgroundColor: "#fef2f2",
    borderRadius: 32,
    overflow: "hidden",
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
    textAlign: "center",
  },
  message: {
    fontSize: 15,
    color: "#6b7280",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  debugBox: {
    backgroundColor: "#fef2f2",
    borderRadius: 8,
    padding: 12,
    width: "100%",
    marginBottom: 20,
  },
  debugText: {
    fontSize: 12,
    color: "#991b1b",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  actions: {
    width: "100%",
  },
});
