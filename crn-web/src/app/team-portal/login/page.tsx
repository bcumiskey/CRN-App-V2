"use client";

import { FormEvent, useEffect, useState } from "react";
import { HardHat } from "lucide-react";
import { API_BASE, apiAuthHeaders } from "@/lib/api";
import { getWorkerToken, setWorkerName, setWorkerToken } from "@/lib/auth-secret";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SESSION_EXPIRED_PARAM } from "../portal-api";

interface LoginResponse {
  token: string;
  user: { userId: string; name: string; role: string; isOwner: boolean };
}

/**
 * Worker portal login — email + password (set by the admin on the Team
 * page). Works in any browser, no app or Apple account needed.
 *
 * Plain fetch (not the shared api client): this request must never carry a
 * stored admin secret as its bearer, only the Vercel preview-bypass headers.
 * On success the worker session token is stored and the page fully reloads
 * into /team-portal so the layout re-detects worker mode from scratch.
 */
export default function TeamPortalLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Already signed in on this device — straight to the portal.
    if (getWorkerToken()) {
      window.location.replace("/team-portal");
      return;
    }
    // Read the flag from window.location instead of useSearchParams so this
    // page needs no Suspense boundary for static prerendering.
    const params = new URLSearchParams(window.location.search);
    if (params.get(SESSION_EXPIRED_PARAM)) {
      setNotice("Your session expired. Please sign in again.");
    }
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`${API_BASE}/api/worker-auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...apiAuthHeaders(),
        },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = (await res.json().catch(() => null)) as
        | (LoginResponse & { error?: string })
        | null;

      if (res.ok && data?.token) {
        setWorkerToken(data.token);
        if (data.user?.name) setWorkerName(data.user.name);
        // Full reload so the portal layout re-evaluates its mode and every
        // page fetches with the new credentials.
        window.location.replace("/team-portal");
        return;
      }

      if (res.status === 503) {
        setError(data?.error ?? "Worker login is not configured yet. Ask your admin.");
      } else if (res.status === 401) {
        setError(data?.error ?? "Invalid email or password");
      } else {
        setError(data?.error ?? `Couldn't sign in (HTTP ${res.status}). Try again.`);
      }
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-sm mx-auto">
      <CardContent>
        <div className="flex justify-center mb-4">
          <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
            <HardHat size={22} className="text-blue-600" />
          </div>
        </div>
        <h2 className="text-lg font-semibold text-gray-900 text-center">
          Team Portal
        </h2>
        <p className="text-sm text-gray-500 text-center mt-1 mb-4">
          Sign in with the email and password your admin set for you.
        </p>

        {notice && (
          <p className="mb-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
            {notice}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            id="portal-email"
            type="email"
            label="Email"
            autoComplete="email"
            autoFocus
            placeholder="you@example.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError(null);
            }}
          />
          <Input
            id="portal-password"
            type="password"
            label="Password"
            autoComplete="current-password"
            placeholder="Password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError(null);
            }}
            error={error ?? undefined}
          />
          <Button type="submit" loading={submitting} className="w-full">
            {submitting ? "Signing in..." : "Sign in"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
