import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Expo Push Helper
// ---------------------------------------------------------------------------

async function sendExpoPush(
  token: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<void> {
  const response = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      to: token,
      title,
      body,
      data,
      sound: "default",
    }),
  });
  if (!response.ok) {
    throw new Error(`Expo push failed: ${response.status}`);
  }
}

// ---------------------------------------------------------------------------
// Core Dispatcher
// ---------------------------------------------------------------------------

/**
 * Create an in-app notification and optionally send push via Expo Push API.
 */
export async function sendNotification(params: {
  userId: string;
  title: string;
  body: string;
  entityType?: string;
  entityId?: string;
}): Promise<void> {
  // 1. Create the notification record
  const notification = await prisma.notification.create({
    data: {
      userId: params.userId,
      title: params.title,
      body: params.body,
      entityType: params.entityType ?? null,
      entityId: params.entityId ?? null,
    },
  });

  // 2. Find all active push tokens for the user
  const tokens = await prisma.pushToken.findMany({
    where: { userId: params.userId, isActive: true },
  });

  if (tokens.length === 0) return;

  // 3. Send push to each token
  const data: Record<string, string> = {};
  if (params.entityType) data.entityType = params.entityType;
  if (params.entityId) data.entityId = params.entityId;

  let pushSent = false;
  let pushError: string | null = null;

  for (const t of tokens) {
    try {
      await sendExpoPush(t.token, params.title, params.body, data);
      pushSent = true;
    } catch (err) {
      pushError = err instanceof Error ? err.message : String(err);
      console.error(`[Notifications] Push failed for token ${t.id}:`, err);
    }
  }

  // 4. Update the notification record with push status
  try {
    await prisma.notification.update({
      where: { id: notification.id },
      data: {
        pushSent,
        pushSentAt: pushSent ? new Date() : null,
        pushError,
      },
    });
  } catch (err) {
    console.error("[Notifications] Failed to update push status:", err);
  }
}

// ---------------------------------------------------------------------------
// Convenience Helpers for Common Events
// ---------------------------------------------------------------------------

export async function notifyJobAssignment(
  userId: string,
  jobNumber: string,
  propertyName: string,
  date: string
): Promise<void> {
  await sendNotification({
    userId,
    title: "New Job Assignment",
    body: `You've been assigned to ${jobNumber} at ${propertyName} on ${date}.`,
    entityType: "job",
    entityId: jobNumber,
  });
}

export async function notifyScheduleChange(
  userId: string,
  jobNumber: string,
  propertyName: string,
  oldDate: string,
  newDate: string
): Promise<void> {
  await sendNotification({
    userId,
    title: "Schedule Changed",
    body: `${jobNumber} at ${propertyName} moved from ${oldDate} to ${newDate}.`,
    entityType: "job",
    entityId: jobNumber,
  });
}

export async function notifyJobCancelled(
  userId: string,
  jobNumber: string,
  propertyName: string,
  date: string
): Promise<void> {
  await sendNotification({
    userId,
    title: "Job Cancelled",
    body: `${jobNumber} at ${propertyName} on ${date} has been cancelled.`,
    entityType: "job",
    entityId: jobNumber,
  });
}

export async function notifyPayPeriodClosed(
  userId: string,
  periodLabel: string,
  totalEarned: number
): Promise<void> {
  await sendNotification({
    userId,
    title: "Pay Period Closed",
    body: `Pay period ${periodLabel} is closed. You earned $${totalEarned.toFixed(2)}.`,
    entityType: "pay_period",
    entityId: periodLabel,
  });
}

export async function notifyInvoiceOverdue(
  userId: string,
  invoiceNumber: string,
  amount: number
): Promise<void> {
  await sendNotification({
    userId,
    title: "Invoice Overdue",
    body: `Invoice ${invoiceNumber} for $${amount.toFixed(2)} is overdue.`,
    entityType: "invoice",
    entityId: invoiceNumber,
  });
}

export async function notifySyncCompleted(
  userId: string,
  sourceName: string,
  created: number
): Promise<void> {
  await sendNotification({
    userId,
    title: "Sync Completed",
    body: `${sourceName} sync finished. ${created} new job${created === 1 ? "" : "s"} created.`,
    entityType: "sync",
    entityId: sourceName,
  });
}
