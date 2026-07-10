/**
 * UnlockModal — shown when the API rejects a request with 401.
 *
 * The user pastes the access passphrase once per device; it is saved to
 * secure storage (see services/api.ts) and verified by retrying a cheap
 * authed endpoint. On success all React Query caches are invalidated so
 * every screen reloads with the now-authorized client.
 *
 * When the server has no shared secret configured, no request ever returns
 * 401, so this modal never appears — zero behavior change.
 */

import { useCallback, useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { Lock } from "lucide-react-native";
import { api, ApiError, clearApiSecret, onUnauthorized, setApiSecret } from "../services/api";
import { Button } from "./ui/Button";

export function UnlockModal() {
  const [visible, setVisible] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => onUnauthorized(() => setVisible(true)), []);

  const handleUnlock = useCallback(async () => {
    const secret = passphrase.trim();
    if (!secret || verifying) return;

    setVerifying(true);
    setErrorMessage(null);

    // Save first so the verification request carries the new secret.
    await setApiSecret(secret);

    try {
      // Cheap authed endpoint — succeeds only if the passphrase is correct.
      await api.get("/settings/preferences");
      setVisible(false);
      setPassphrase("");
      // Reload everything now that requests are authorized.
      void queryClient.invalidateQueries();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        await clearApiSecret();
        setErrorMessage("That passphrase didn't work. Check it and try again.");
      } else {
        setErrorMessage("Couldn't reach the server. Check your connection and try again.");
      }
    } finally {
      setVerifying(false);
    }
  }, [passphrase, verifying, queryClient]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => {}}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <Lock size={28} color="#2563eb" />
          </View>
          <Text style={styles.title}>Unlock Cleaning Right Now</Text>
          <Text style={styles.subtitle}>
            Enter the access passphrase for this app. You only need to do this once on this
            device.
          </Text>
          <TextInput
            style={styles.input}
            value={passphrase}
            onChangeText={setPassphrase}
            placeholder="Access passphrase"
            placeholderTextColor="#9ca3af"
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
            editable={!verifying}
            onSubmitEditing={handleUnlock}
            returnKeyType="go"
          />
          {errorMessage && <Text style={styles.error}>{errorMessage}</Text>}
          <Button
            onPress={handleUnlock}
            loading={verifying}
            disabled={!passphrase.trim()}
            fullWidth
            size="lg"
          >
            Unlock
          </Button>
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
});
