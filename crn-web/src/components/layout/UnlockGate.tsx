"use client";

import { FormEvent, useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { API_BASE, apiAuthHeaders } from "@/lib/api";
import { setApiSecret, UNAUTHORIZED_EVENT } from "@/lib/auth-secret";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

/**
 * Full-screen unlock overlay for the runtime API shared secret.
 *
 * Mounted once in the root layout. It stays invisible until some API call
 * answers 401 (the fetch layers dispatch UNAUTHORIZED_EVENT), which only
 * happens once API_SHARED_SECRET is configured on crn-api — with no secret
 * configured (today's production) this component never renders anything.
 *
 * On submit the passphrase is verified against a cheap authed endpoint
 * (GET /api/settings/preferences); only a 200 stores it and reloads.
 */
export function UnlockGate() {
  const [visible, setVisible] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    const show = () => setVisible(true);
    window.addEventListener(UNAUTHORIZED_EVENT, show);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, show);
  }, []);

  if (!visible) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const secret = passphrase.trim();
    if (!secret) {
      setError("Enter the passphrase.");
      return;
    }
    setVerifying(true);
    setError(null);
    try {
      // Cheap authed GET — 200 proves the passphrase, 401 rejects it.
      const res = await fetch(`${API_BASE}/api/settings/preferences`, {
        headers: {
          "Content-Type": "application/json",
          ...apiAuthHeaders(),
          Authorization: `Bearer ${secret}`,
        },
      });
      if (res.ok) {
        setApiSecret(secret);
        // Reload so every page refetches with the new credentials
        window.location.reload();
        return;
      }
      if (res.status === 401) {
        setError("That passphrase didn't work. Check it and try again.");
      } else {
        setError(`Couldn't verify the passphrase (HTTP ${res.status}). Try again.`);
      }
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/70 p-4">
      <Card className="w-full max-w-sm">
        <CardContent>
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
              <Lock size={22} className="text-blue-600" />
            </div>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 text-center">
            Enter the app passphrase
          </h2>
          <p className="text-sm text-gray-500 text-center mt-1 mb-4">
            This device isn&apos;t unlocked yet. Paste the passphrase to continue —
            you&apos;ll only need to do this once per device.
          </p>
          <form onSubmit={handleSubmit} className="space-y-3">
            <Input
              id="app-passphrase"
              type="password"
              autoFocus
              autoComplete="off"
              placeholder="Passphrase"
              value={passphrase}
              onChange={(e) => {
                setPassphrase(e.target.value);
                setError(null);
              }}
              error={error ?? undefined}
            />
            <Button type="submit" loading={verifying} className="w-full">
              {verifying ? "Verifying..." : "Unlock"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
