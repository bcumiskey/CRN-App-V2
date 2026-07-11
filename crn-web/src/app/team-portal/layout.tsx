"use client";

import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { HardHat, Sun, CalendarDays, Wallet, LogOut } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { cn } from "@/lib/utils";
import {
  getApiSecret,
  getWorkerName,
  getWorkerToken,
} from "@/lib/auth-secret";
import {
  endWorkerSession,
  getViewAsUserId,
  portalApi,
  PORTAL_LOGIN_PATH,
  setViewAsUserId,
} from "./portal-api";

const tabs = [
  { href: "/team-portal", label: "Today", icon: Sun },
  { href: "/team-portal/schedule", label: "Schedule", icon: CalendarDays },
  { href: "/team-portal/pay", label: "Pay", icon: Wallet },
];

/**
 * Team Portal layout — dual mode.
 *
 * ADMIN MODE (unchanged from the v2.4 preview): the admin browses
 * /team-portal inside the normal admin shell. Preview banner, admin sidebar,
 * requests ride the admin credential layers.
 *
 * WORKER MODE: a cleaner logged in with their own email + password. The
 * portal renders as a standalone app — no admin sidebar, no preview banner
 * (it IS their view now) — with a minimal header (business name, worker's
 * name, Log out) and the Today/Schedule/Pay tabs.
 *
 * Mode detection (simple and explicit, evaluated client-side after mount):
 *   worker mode ⇔ a worker token is stored on this device
 *                 OR (no admin secret is stored AND the route is the
 *                     portal login page — an anonymous visitor heading to
 *                     the worker login gets the standalone treatment).
 *   Everything else is admin mode.
 *
 * Chrome suppression: the root layout unconditionally wraps every route in
 * the admin <Sidebar/>, and this nested layout cannot remove an ancestor's
 * DOM. Instead, worker mode renders a fixed inset-0 wrapper that covers the
 * whole viewport (its own scroll container), visually replacing the admin
 * shell without touching the root layout. z-40 keeps it under the z-50
 * UnlockGate, which never fires in worker mode anyway (portal-api handles
 * worker 401s by returning to the portal login).
 */
export default function TeamPortalLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === PORTAL_LOGIN_PATH;

  // null = not yet determined (first client render; localStorage unreadable
  // during SSR). Render nothing until we know which shell to draw so admins
  // never flash the worker chrome and vice versa.
  const [workerMode, setWorkerMode] = useState<boolean | null>(null);
  const [workerName, setWorkerName] = useState<string | null>(null);

  useEffect(() => {
    const hasWorkerToken = !!getWorkerToken();
    setWorkerMode(hasWorkerToken || (!getApiSecret() && isLoginPage));
    setWorkerName(getWorkerName());
  }, [pathname, isLoginPage]);

  if (workerMode === null) return null;

  if (workerMode) {
    return (
      <div className="fixed inset-0 z-40 overflow-y-auto bg-gray-100">
        {isLoginPage ? (
          <div className="min-h-full flex flex-col justify-center px-4 py-12">
            {children}
          </div>
        ) : (
          <>
            {/* Portal header — the worker's whole app chrome */}
            <header className="bg-gray-900 text-white">
              <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h1 className="text-lg font-semibold tracking-tight">Clean Right Now</h1>
                  <p className="text-xs text-gray-400">Team Portal</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {workerName && (
                    <span className="text-sm text-gray-300 truncate max-w-[10rem]">
                      {workerName}
                    </span>
                  )}
                  <button
                    onClick={() => endWorkerSession(false)}
                    className="flex items-center gap-1.5 rounded-lg border border-gray-700 px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
                  >
                    <LogOut size={14} />
                    Log out
                  </button>
                </div>
              </div>
            </header>

            <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
              <PortalTabs pathname={pathname} />
              {children}
            </div>
          </>
        )}
      </div>
    );
  }

  // ── ADMIN MODE — preview the portal as a chosen worker ────────────────────
  return (
    <div className="p-6 max-w-4xl">
      <ViewAsBanner />

      <PageHeader title="Team Portal" subtitle="The worker view, inside the admin app" />

      {!isLoginPage && <PortalTabs pathname={pathname} />}
      {children}
    </div>
  );
}

interface PortalMember {
  id: string;
  name: string;
  role: string;
  status: string;
  hasPortalPassword?: boolean;
}

/**
 * Admin-mode banner with a "Viewing as" worker selector. Loads the team,
 * defaults to the first active worker (persisted per-tab), and — via
 * setViewAsUserId — makes every portal page re-fetch that worker's data.
 */
function ViewAsBanner() {
  const [members, setMembers] = useState<PortalMember[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await portalApi.get<{ members: PortalMember[] }>("/team", {
          status: "all",
        });
        if (cancelled) return;
        const workers = data.members.filter((m) => m.role === "worker");
        setMembers(workers);

        const stored = getViewAsUserId();
        const validStored =
          stored && workers.some((w) => w.id === stored) ? stored : null;
        const firstActive = workers.find((w) => w.status === "active") ?? workers[0];
        const initial = validStored ?? firstActive?.id ?? null;
        setSelectedId(initial);
        // Set the default (and notify pages) when nothing valid was stored yet.
        if (initial && initial !== stored) setViewAsUserId(initial);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onChange = (id: string) => {
    setSelectedId(id);
    setViewAsUserId(id);
  };

  const active = (members ?? []).filter(
    (m) => m.status === "active" || m.status === "lame_duck"
  );
  const archived = (members ?? []).filter((m) => m.status === "archived");
  const selectedName = members?.find((m) => m.id === selectedId)?.name;

  return (
    <div className="mb-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
      <HardHat size={18} className="text-amber-600 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-amber-800">
          Admin preview
          {selectedName ? (
            <>
              {" "}
              — viewing the portal as <strong>{selectedName}</strong>
            </>
          ) : null}
          . Workers sign in at{" "}
          <code className="text-amber-900">/team-portal/login</code> for their own view.
        </p>
        {members && members.length > 0 ? (
          <label className="mt-2 flex items-center gap-2 text-sm text-amber-800">
            <span className="shrink-0">Viewing as:</span>
            <select
              value={selectedId ?? ""}
              onChange={(e) => onChange(e.target.value)}
              className="rounded-md border border-amber-300 bg-white px-2 py-1 text-gray-900 max-w-[16rem]"
            >
              <optgroup label="Active">
                {active.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                    {m.hasPortalPassword ? " ✓" : ""}
                  </option>
                ))}
              </optgroup>
              {archived.length > 0 && (
                <optgroup label="Archived">
                  {archived.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </label>
        ) : members && members.length === 0 ? (
          <p className="mt-2 text-sm text-amber-700">
            No team members yet — add them on the Team page.
          </p>
        ) : failed ? (
          <p className="mt-2 text-sm text-amber-700">Couldn&apos;t load the team list.</p>
        ) : null}
      </div>
    </div>
  );
}

function PortalTabs({ pathname }: { pathname: string }) {
  return (
    <div className="flex gap-1 border-b border-gray-200 mb-6">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive =
          tab.href === "/team-portal"
            ? pathname === "/team-portal"
            : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "flex items-center gap-2 px-4 py-2 -mb-px border-b-2 text-sm font-medium transition-colors",
              isActive
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            )}
          >
            <Icon size={16} />
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
