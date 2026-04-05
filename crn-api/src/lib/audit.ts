import { prisma } from "./prisma";
import type { Prisma } from "@prisma/client";

interface AuditEntry {
  userId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  details?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Write an entry to the audit log. Fire-and-forget — does not throw on failure.
 */
export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: entry.userId ?? null,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        summary: entry.summary,
        details: (entry.details as Prisma.InputJsonValue) ?? undefined,
        ipAddress: entry.ipAddress ?? null,
        userAgent: entry.userAgent ?? null,
      },
    });
  } catch (err) {
    console.error("[AuditLog] Failed to write:", err);
  }
}
