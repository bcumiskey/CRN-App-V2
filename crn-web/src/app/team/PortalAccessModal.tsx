"use client";

// Admin-side "Portal access" controls, shared by the Team list and the
// member detail page. Sets or clears a worker's portal password via
// PATCH /api/team/[id] { portalPassword } — the plaintext goes straight to
// the API (which hashes it) and is never stored or logged client-side.

import { FormEvent, useEffect, useState } from "react";
import { Key } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

const MIN_PASSWORD_LENGTH = 8;

function toast(msg: string, type: "success" | "error" = "success") {
  const div = document.createElement("div");
  div.className = `fixed top-4 right-4 z-50 px-4 py-2 rounded-lg shadow-lg text-white text-sm ${type === "error" ? "bg-red-600" : "bg-green-600"}`;
  div.textContent = msg;
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 3000);
}

function apiErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    const data = err.data as { error?: string } | null;
    if (data?.error) return data.error;
    return `${fallback} (${err.status})`;
  }
  return fallback;
}

/** Where cleaners sign in — shown to the admin so they can pass it along. */
export function portalLoginUrl(): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/team-portal/login`;
}

/**
 * Confirm + clear a member's portal password (PATCH portalPassword: "").
 * Returns true when access was removed so callers can refetch.
 */
export async function removePortalAccess(
  memberId: string,
  memberName: string
): Promise<boolean> {
  if (
    !window.confirm(
      `Remove portal access for ${memberName}? They will no longer be able to sign in to the Team Portal until you set a new password.`
    )
  ) {
    return false;
  }
  try {
    await api.patch(`/team/${memberId}`, { portalPassword: "" });
    toast(`Portal access removed for ${memberName}`);
    return true;
  } catch (err) {
    toast(apiErrorMessage(err, "Failed to remove portal access"), "error");
    return false;
  }
}

interface PortalAccessModalProps {
  open: boolean;
  onClose: () => void;
  memberId: string;
  memberName: string;
  /** True when the member already has a password (this sets a new one). */
  hasPortalPassword: boolean;
  /** Called after a successful save so the caller can refetch. */
  onSaved: () => void;
}

export function PortalAccessModal({
  open,
  onClose,
  memberId,
  memberName,
  hasPortalPassword,
  onSaved,
}: PortalAccessModalProps) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setPassword("");
      setConfirmPassword("");
      setFieldError(null);
    }
  }, [open]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (password.length < MIN_PASSWORD_LENGTH) {
      setFieldError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
      return;
    }
    if (password !== confirmPassword) {
      setFieldError("Passwords do not match");
      return;
    }

    setIsSaving(true);
    try {
      await api.patch(`/team/${memberId}`, { portalPassword: password });
      toast(
        hasPortalPassword
          ? `Portal password updated for ${memberName}`
          : `Portal access enabled for ${memberName}`
      );
      onSaved();
      onClose();
    } catch (err) {
      toast(apiErrorMessage(err, "Failed to set portal password"), "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        hasPortalPassword
          ? `Reset portal password for ${memberName}`
          : `Set portal password for ${memberName}`
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-gray-600">
          Cleaners sign in at{" "}
          <span className="font-medium text-gray-900 break-all">{portalLoginUrl()}</span>{" "}
          on any phone — no app or Apple account needed. Share this password
          with {memberName} directly.
        </p>

        <Input
          label={`Password (min ${MIN_PASSWORD_LENGTH} characters)`}
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setFieldError(null);
          }}
          placeholder="Enter password"
          required
        />

        <Input
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => {
            setConfirmPassword(e.target.value);
            setFieldError(null);
          }}
          placeholder="Confirm password"
          required
          error={fieldError ?? undefined}
        />

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isSaving}>
            <Key size={16} />
            {hasPortalPassword ? "Update Password" : "Set Password"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
