import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { success, created, error, validationError } from "@/lib/responses";
import { z } from "zod";

// ---------------------------------------------------------------------------
// GET /api/owners — List owners
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  const owners = await prisma.propertyOwner.findMany({
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
      },
      _count: { select: { properties: true } },
    },
    orderBy: { name: "asc" },
  });

  // Map to V1-compatible shape
  const mapped = owners.map((o) => ({
    ...o,
    isActive: true, // V2 owners don't have a status field — all are active
    defaultBaseRate: o.properties[0]?.defaultJobFee ?? 0,
    defaultBillingType: o.billingType,
    properties: o.properties.map((p) => ({
      ...p,
      baseRate: p.defaultJobFee ?? 0,
      expensePercent: p.houseCutPercent ?? 0,
    })),
  }));

  return success(mapped);
}

// ---------------------------------------------------------------------------
// POST /api/owners — Create owner
// ---------------------------------------------------------------------------

const createOwnerSchema = z.object({
  name: z.string().min(1),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  company: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  billingType: z.enum(["per_job", "monthly"]).optional(),
  paymentTerms: z.string().optional(),
  notes: z.string().nullable().optional(),
});

export async function POST(request: NextRequest) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error("Invalid JSON body");
  }

  const parsed = createOwnerSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const data = parsed.data;

  try {
    const owner = await prisma.propertyOwner.create({
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone,
        company: data.company,
        address: data.address,
        ...(data.billingType ? { billingType: data.billingType } : {}),
        ...(data.paymentTerms ? { paymentTerms: data.paymentTerms } : {}),
        notes: data.notes,
      },
    });

    await logAudit({
      userId: result.user.userId,
      action: "create",
      entityType: "property_owner",
      entityId: owner.id,
      summary: `Created owner ${owner.name}`,
    });

    return created(owner);
  } catch (err) {
    console.error("[POST /api/owners]", err);
    return error("Failed to create owner", 500);
  }
}
