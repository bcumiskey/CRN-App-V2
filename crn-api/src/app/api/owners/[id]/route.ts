import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { success, error, notFound, validationError } from "@/lib/responses";
import { z } from "zod";

type RouteContext = { params: Promise<{ id: string }> };

// ---------------------------------------------------------------------------
// GET /api/owners/[id] — Owner detail with properties and recent invoices
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest, { params }: RouteContext) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  const { id } = await params;

  try {
    const owner = await prisma.propertyOwner.findUnique({
      where: { id },
      include: {
        properties: {
          select: {
            id: true,
            name: true,
            code: true,
            defaultJobFee: true,
            houseCutPercent: true,
            status: true,
            address: true,
          },
          orderBy: { name: "asc" },
        },
        invoices: {
          take: 10,
          orderBy: { invoiceDate: "desc" },
          select: {
            id: true,
            invoiceNumber: true,
            invoiceDate: true,
            total: true,
            status: true,
            property: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!owner) return notFound("Owner not found");

    // Map to V1-compatible shape (same convention as GET /api/owners)
    const mapped = {
      ...owner,
      isActive: true, // V2 owners don't have a status field — all are active
      defaultBaseRate: owner.properties[0]?.defaultJobFee ?? 0,
      defaultBillingType: owner.billingType,
      preferredContactMethod: null, // no V2 column — not persisted
      properties: owner.properties.map((p) => ({
        ...p,
        baseRate: p.defaultJobFee ?? 0,
        expensePercent: p.houseCutPercent ?? 0,
      })),
      recentInvoices: owner.invoices.map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        invoiceDate: inv.invoiceDate,
        propertyName: inv.property?.name ?? "",
        total: inv.total,
        status: inv.status,
      })),
    };

    return success(mapped);
  } catch (err) {
    console.error("[GET /api/owners/[id]]", err);
    return error("Failed to fetch owner", 500);
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/owners/[id] — Update owner
// ---------------------------------------------------------------------------

const updateOwnerSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  company: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  billingType: z.enum(["per_job", "monthly"]).optional(),
  paymentTerms: z.string().optional(),
  notes: z.string().nullable().optional(),
});

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error("Invalid JSON body");
  }

  const parsed = updateOwnerSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const data = parsed.data;

  try {
    const existing = await prisma.propertyOwner.findUnique({ where: { id } });
    if (!existing) return notFound("Owner not found");

    const owner = await prisma.propertyOwner.update({
      where: { id },
      data,
    });

    await logAudit({
      userId: result.user.userId,
      action: "update",
      entityType: "property_owner",
      entityId: id,
      summary: `Updated owner ${owner.name}`,
      details: { fields: Object.keys(data) },
    });

    return success(owner);
  } catch (err) {
    console.error("[PATCH /api/owners/[id]]", err);
    return error("Failed to update owner", 500);
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/owners/[id] — Delete owner (blocked if properties/invoices exist)
// ---------------------------------------------------------------------------

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  const { id } = await params;

  try {
    const existing = await prisma.propertyOwner.findUnique({
      where: { id },
      include: {
        _count: { select: { properties: true, invoices: true } },
      },
    });
    if (!existing) return notFound("Owner not found");

    if (existing._count.properties > 0 || existing._count.invoices > 0) {
      return error(
        `Cannot delete owner "${existing.name}": they have ${existing._count.properties} propert${existing._count.properties === 1 ? "y" : "ies"} and ${existing._count.invoices} invoice${existing._count.invoices === 1 ? "" : "s"}. Reassign or remove those first.`,
        409
      );
    }

    await prisma.propertyOwner.delete({ where: { id } });

    await logAudit({
      userId: result.user.userId,
      action: "delete",
      entityType: "property_owner",
      entityId: id,
      summary: `Deleted owner ${existing.name}`,
    });

    return success({ deleted: true });
  } catch (err) {
    console.error("[DELETE /api/owners/[id]]", err);
    return error("Failed to delete owner", 500);
  }
}
