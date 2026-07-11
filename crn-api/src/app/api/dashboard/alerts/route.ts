import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { success, error } from "@/lib/responses";
import { todayYMD, addDaysYMD } from "@/lib/business-time";

// ---------------------------------------------------------------------------
// GET /api/dashboard/alerts — Operational alerts for the dashboard
//
// Generates two live alert classes Alex asked for:
//   1. Back-to-back (B2B) jobs coming up — tight same-day turnarounds she
//      wants surfaced, not buried in the list.
//   2. Possible duplicate jobs — the same property with more than one active
//      job on the same day (e.g. a clean entered manually AND synced from the
//      calendar). Flagged for review, never auto-removed.
// ---------------------------------------------------------------------------

interface Alert {
  id: string;
  severity: "critical" | "warning" | "info";
  title: string;
  description: string;
  actionUrl?: string;
}

const ACTIVE_STATUSES = ["SCHEDULED", "IN_PROGRESS", "COMPLETED", "INVOICED"];

export async function GET(request: NextRequest) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  try {
    const today = todayYMD();
    const horizon = addDaysYMD(today, 14); // look two weeks ahead
    const pastWindow = addDaysYMD(today, -14); // and two weeks back for dupes

    const alerts: Alert[] = [];

    // ── 1. Upcoming back-to-back jobs ──────────────────────────────────────
    const b2bJobs = await prisma.job.findMany({
      where: {
        isBtoB: true,
        status: { in: ["SCHEDULED", "IN_PROGRESS"] },
        scheduledDate: { gte: today, lte: horizon },
      },
      select: {
        id: true,
        scheduledDate: true,
        scheduledTime: true,
        property: { select: { name: true } },
      },
      orderBy: [{ scheduledDate: "asc" }, { scheduledTime: "asc" }],
    });

    for (const job of b2bJobs) {
      const when = job.scheduledDate === today ? "today" : job.scheduledDate;
      alerts.push({
        id: `b2b-${job.id}`,
        severity: job.scheduledDate === today ? "critical" : "warning",
        title: `Back-to-back: ${job.property?.name ?? "job"}`,
        description: `Same-day turnaround ${when}${
          job.scheduledTime ? ` at ${job.scheduledTime}` : ""
        } — tight timing, plan the crew accordingly.`,
        actionUrl: "/jobs",
      });
    }

    // ── 2. Possible duplicate jobs (same property + date) ──────────────────
    const windowJobs = await prisma.job.findMany({
      where: {
        status: { in: ACTIVE_STATUSES },
        scheduledDate: { gte: pastWindow, lte: horizon },
      },
      select: {
        id: true,
        scheduledDate: true,
        propertyId: true,
        source: true,
        property: { select: { name: true } },
      },
    });

    const groups = new Map<string, typeof windowJobs>();
    for (const job of windowJobs) {
      const key = `${job.propertyId}|${job.scheduledDate}`;
      const arr = groups.get(key) ?? [];
      arr.push(job);
      groups.set(key, arr);
    }

    for (const [, jobs] of groups) {
      if (jobs.length < 2) continue;
      const first = jobs[0];
      const sources = [...new Set(jobs.map((j) => j.source))].join(" + ");
      alerts.push({
        id: `dup-${first.propertyId}-${first.scheduledDate}`,
        severity: "warning",
        title: `Possible duplicate: ${first.property?.name ?? "property"}`,
        description: `${jobs.length} jobs on ${first.scheduledDate} (sources: ${sources}). Review and remove any that were double-entered.`,
        actionUrl: "/jobs",
      });
    }

    const summary = {
      total: alerts.length,
      critical: alerts.filter((a) => a.severity === "critical").length,
      warnings: alerts.filter((a) => a.severity === "warning").length,
    };

    return success({ alerts, summary });
  } catch (err) {
    console.error("[GET /api/dashboard/alerts]", err);
    return error("Failed to generate alerts", 500);
  }
}
