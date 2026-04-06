/**
 * V1 Compatibility Layer
 *
 * V1's pages call fetch('/api/...') and expect specific response shapes.
 * V2's API returns different shapes (wrapped responses, renamed fields).
 *
 * This module provides a drop-in replacement for fetch() that:
 * 1. Routes calls to V2's external API
 * 2. Unwraps response objects ({jobs: [...]}) → plain arrays
 * 3. Translates V2 field names back to V1 names for the UI
 *
 * Usage in V1 pages: replace `fetch('/api/...')` with `v1Fetch('/api/...')`
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://crn-api.vercel.app";

// ── Field mapping: V2 → V1 ─────────────────────────────────────

function mapJobV2toV1(job: any): any {
  return {
    ...job,
    // Field renames
    date: job.scheduledDate ?? job.date,
    time: job.scheduledTime ?? job.time,
    rate: job.totalFee ?? job.rate,
    expensePercent: job.houseCutPercent ?? job.expensePercent,
    // Status → boolean
    completed: job.status === "COMPLETED" || job.status === "INVOICED" || job.completed === true,
    // Keep V2 fields too (both names available)
    scheduledDate: job.scheduledDate ?? job.date,
    scheduledTime: job.scheduledTime ?? job.time,
    totalFee: job.totalFee ?? job.rate,
    houseCutPercent: job.houseCutPercent ?? job.expensePercent,
    status: job.status,
    jobNumber: job.jobNumber,
    jobType: job.jobType,
    isBtoB: job.isBtoB,
    // Map assignments
    assignments: (job.assignments || []).map((a: any) => ({
      ...a,
      teamMember: a.user ?? a.teamMember ?? { id: a.userId, name: "Unknown" },
      teamMemberId: a.userId ?? a.teamMemberId,
      // Keep V2 fields
      user: a.user ?? a.teamMember,
      userId: a.userId ?? a.teamMemberId,
      share: a.share ?? 1.0,
    })),
    // Property — add color if missing
    property: job.property ? {
      ...job.property,
      color: job.property.color ?? generateColor(job.property.name ?? ""),
    } : job.property,
  };
}

function mapPropertyV2toV1(prop: any): any {
  return {
    ...prop,
    baseRate: prop.defaultJobFee ?? prop.baseRate ?? 0,
    expensePercent: prop.houseCutPercent ?? prop.expensePercent ?? 0,
    isActive: prop.status === "active" || prop.isActive === true,
    ownerName: prop.owner?.name ?? prop.ownerName ?? "",
    ownerEmail: prop.owner?.email ?? prop.ownerEmail ?? "",
    ownerPhone: prop.owner?.phone ?? prop.ownerPhone ?? "",
    // Keep V2 fields
    defaultJobFee: prop.defaultJobFee ?? prop.baseRate,
    houseCutPercent: prop.houseCutPercent ?? prop.expensePercent,
    status: prop.status,
    code: prop.code,
  };
}

function mapTeamMemberV2toV1(member: any): any {
  return {
    ...member,
    isActive: member.status === "active" || member.isActive === true,
    hasPassword: false, // V2 uses Clerk, no password field
    imageUrl: member.avatarUrl ?? member.imageUrl,
    // Keep V2 fields
    status: member.status,
    avatarUrl: member.avatarUrl,
  };
}

function mapInvoiceV2toV1(inv: any): any {
  return {
    ...inv,
    property: inv.property ? {
      ...inv.property,
      ownerName: inv.owner?.name ?? "",
    } : null,
  };
}

// ── Field mapping: V1 → V2 (for POST/PATCH requests) ──────────

function mapJobV1toV2(data: any): any {
  const mapped: any = { ...data };
  // Rename V1 fields to V2
  if (data.date && !data.scheduledDate) mapped.scheduledDate = data.date;
  if (data.time && !data.scheduledTime) mapped.scheduledTime = data.time;
  if (data.rate && !data.totalFee) mapped.totalFee = parseFloat(data.rate);
  if (data.expensePercent !== undefined && data.houseCutPercent === undefined) mapped.houseCutPercent = parseFloat(data.expensePercent);
  if (data.teamMemberIds && !data.userIds) mapped.userIds = data.teamMemberIds;
  // Status handling
  if (data.completed !== undefined && data.status === undefined) {
    mapped.status = data.completed ? "COMPLETED" : "SCHEDULED";
  }
  // Clean up V1-only fields
  delete mapped.date;
  delete mapped.time;
  delete mapped.rate;
  delete mapped.expensePercent;
  delete mapped.teamMemberIds;
  delete mapped.completed;
  return mapped;
}

function mapPropertyV1toV2(data: any): any {
  const mapped: any = { ...data };
  if (data.baseRate !== undefined && data.defaultJobFee === undefined) mapped.defaultJobFee = data.baseRate;
  if (data.expensePercent !== undefined && data.houseCutPercent === undefined) mapped.houseCutPercent = data.expensePercent;
  if (data.isActive !== undefined && data.status === undefined) mapped.status = data.isActive ? "active" : "inactive";
  delete mapped.baseRate;
  delete mapped.expensePercent;
  delete mapped.isActive;
  return mapped;
}

// ── Response unwrapping ─────────────────────────────────────────

const UNWRAP_KEYS: Record<string, string> = {
  "/api/jobs": "jobs",
  "/api/properties": "properties",
  "/api/team": "members",
  "/api/invoices": "invoices",
  "/api/owners": "", // already plain array or check
  "/api/linens": "items",
  "/api/supplies": "items",
  "/api/recurring-schedules": "schedules",
  "/api/notes": "notes",
};

function unwrapResponse(path: string, data: any): any {
  // Find matching unwrap key
  for (const [pattern, key] of Object.entries(UNWRAP_KEYS)) {
    if (path.startsWith(pattern) && path.split("/").length <= pattern.split("/").length + 1) {
      if (key && data && typeof data === "object" && !Array.isArray(data) && data[key]) {
        return data[key];
      }
    }
  }
  return data;
}

function mapResponseItems(path: string, data: any): any {
  if (!Array.isArray(data)) return data;

  if (path.startsWith("/api/jobs")) {
    return data.map(mapJobV2toV1);
  }
  if (path.startsWith("/api/properties")) {
    return data.map(mapPropertyV2toV1);
  }
  if (path.startsWith("/api/team")) {
    return data.map(mapTeamMemberV2toV1);
  }
  if (path.startsWith("/api/invoices")) {
    return data.map(mapInvoiceV2toV1);
  }
  return data;
}

// ── Color generation (V1 stored colors, V2 generates them) ─────

function generateColor(name: string): string {
  const colors = [
    "#3B82F6", "#10B981", "#8B5CF6", "#EC4899",
    "#6366F1", "#14B8A6", "#F97316", "#06B6D4",
    "#EF4444", "#84CC16", "#A855F7", "#F59E0B",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

// ── Main fetch wrapper ──────────────────────────────────────────

export async function v1Fetch(
  url: string,
  options?: RequestInit
): Promise<Response> {
  // Extract the API path
  const path = url.startsWith("/api") ? url : `/api${url}`;
  const [pathPart, queryString] = path.split("?");
  const fullUrl = `${API_BASE}${pathPart}${queryString ? "?" + queryString : ""}`;

  // Map request body for POST/PATCH/PUT
  let body = options?.body;
  if (body && typeof body === "string") {
    try {
      let parsed = JSON.parse(body);
      if (pathPart.startsWith("/api/jobs") && (options?.method === "POST" || options?.method === "PATCH")) {
        parsed = mapJobV1toV2(parsed);
      }
      if (pathPart.startsWith("/api/properties") && (options?.method === "POST" || options?.method === "PATCH" || options?.method === "PUT")) {
        parsed = mapPropertyV1toV2(parsed);
      }
      body = JSON.stringify(parsed);
    } catch {
      // Not JSON, pass through
    }
  }

  // Make the request to V2 API
  const response = await fetch(fullUrl, {
    ...options,
    body,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  // For non-OK responses, pass through as-is
  if (!response.ok) {
    return response;
  }

  // For GET responses, unwrap and map fields
  const contentType = response.headers.get("content-type");
  if (!contentType?.includes("json")) {
    return response;
  }

  const rawData = await response.json();
  let data = unwrapResponse(pathPart, rawData);
  data = mapResponseItems(pathPart, data);

  // Return a new Response with the mapped data
  return new Response(JSON.stringify(data), {
    status: response.status,
    statusText: response.statusText,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Drop-in replacement for V1's fetch() calls.
 * V1 pages can use this with minimal changes:
 *
 * Before: const response = await fetch('/api/jobs?month=4&year=2026')
 * After:  const response = await v1Fetch('/api/jobs?month=4&year=2026')
 */
export default v1Fetch;
