/**
 * WorkerLoginModal — per-cleaner sign-in with email + password.
 *
 * Opens when:
 * - a stored worker session token is rejected by the server (401 → the token
 *   is cleared and services/api emits worker-login-needed with "expired"), or
 * - the user chooses "Sign in as a team member" on the UnlockModal, or logs
 *   out from the (worker) More menu (both emit "manual").
 *
 * On success the token and the worker's identity are saved to secure storage
 * (see services/api.ts) and all React Query caches are invalidated so every
 * screen reloads under the real per-cleaner identity.
 *
 * With no worker token stored and the API open (today's production), this
 * modal never appears — zero behavior change.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { UserRound } from "lucide-react-native";
import {
  api,
  ApiError,
  getWorkerUser,
  onWorkerLoginNeeded,
  requestUnlock,
  setWorkerSession,
  type WorkerLoginReason,
} from "../services/api";
import { Button } from "./ui/Button";

interface LoginResponse {
  token: string;
  user: {
    userId: string;
    name: string;
    role: string;
    isOwner: boolean;
  };
}

export function WorkerLoginModal() {
  const [visible, setVisible] = useState(false);
  const [reason, setReason] = useState<WorkerLoginReason>("manual");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Whether the modal was already visible when a new event arrives — an
  // "expired" reason must not be downgraded to "manual" while it is open.
  const visibleRef = useRef(false);
  useEffect(() => {
    visibleRef.current = visible;
  }, [visible]);

  useEffect(
    () =>
      onWorkerLoginNeeded((why) => {
        setReason((prev) =>
          why === "expired" ? "expired" : visibleRef.current ? prev : "manual"
        );
        setVisible(true);
        // Prefill the email of the worker who last signed in on this device.
        void getWorkerUser().then((user) => {
          if (user?.email) {
            setEmail((current) => current || user.email!);
          }
        });
      }),
    []
  );

  const close = useCallback(() => {
    setVisible(false);
    setPassword("");
    setErrorMessage(null);
  }, []);

  const handleSignIn = useCallback(async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password || submitting) return;

    setSubmitting(true);
    setErrorMessage(null);

    try {
      const result = await api.post<LoginResponse>("/worker-auth/login", {
        email: trimmedEmail,
        password,
      });
      await setWorkerSession(result.token, {
        ...result.user,
        email: trimmedEmail,
      });
      close();
      // Reload everything under the new per-cleaner identity.
      void queryClient.invalidateQueries();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setErrorMessage("Invalid email or password.");
      } else if (err instanceof ApiError && err.status === 503) {
        setErrorMessage(
          "Worker sign-in isn't set up yet. Ask your admin to enable it."
        );
      } else if (err instanceof ApiError && err.status === 400) {
        setErrorMessage("Enter your email and password.");
      } else {
        setErrorMessage(
          "Couldn't reach the server. Check your connection and try again."
        );
      }
    } finally {
      setSubmitting(false);
    }
  }, [email, password, submitting, queryClient, close]);

  const switchToPassphrase = useCallback(() => {
    close();
    requestUnlock();
  }, [close]);

  // "Not now" is offered only when the user opened this screen themselves;
  // an expired session blocks (matching the UnlockModal's behavior) so the
  // app is never left making requests that can only 401.
  const dismissible = reason === "manual";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (dismissible) close();
      }}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <UserRound size={28} color="#2563eb" />
          </View>
          <Text style={styles.title}>Team member sign in</Text>
          <Text style={styles.subtitle}>
            {reason === "expired"
              ? "Your session has ended. Sign in again to keep going."
              : "Sign in with the email and password your admin set up for you."}
          </Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor="#9ca3af"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            keyboardType="email-address"
            editable={!submitting}
            returnKeyType="next"
          />
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor="#9ca3af"
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
            editable={!submitting}
            onSubmitEditing={handleSignIn}
            returnKeyType="go"
          />
          {errorMessage && <Text style={styles.error}>{errorMessage}</Text>}
          <Button
            onPress={handleSignIn}
            loading={submitting}
            disabled={!email.trim() || !password}
            fullWidth
            size="lg"
          >
            Sign In
          </Button>
          <TouchableOpacity
            style={styles.link}
            onPress={switchToPassphrase}
            disabled={submitting}
          >
            <Text style={styles.linkText}>Use access passphrase instead</Text>
          </TouchableOpacity>
          {dismissible && (
            <TouchableOpacity
              style={styles.link}
              onPress={close}
              disabled={submitting}
            >
              <Text style={styles.linkMuted}>Not now</Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(17, 24, 39, 0.6)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 20,
  },
  input: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: "#111827",
    backgroundColor: "#f9fafb",
    marginBottom: 12,
  },
  error: {
    width: "100%",
    fontSize: 13,
    color: "#dc2626",
    marginBottom: 12,
  },
  link: {
    marginTop: 14,
    paddingVertical: 4,
  },
  linkText: {
    fontSize: 14,
    color: "#2563eb",
    fontWeight: "500",
  },
  linkMuted: {
    fontSize: 14,
    color: "#6b7280",
    fontWeight: "500",
  },
});
