import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { success, error, notFound, validationError } from "@/lib/responses";
import { z } from "zod";

// ---------------------------------------------------------------------------
// GET /api/properties/[id] — Property detail
// ---------------------------------------------------------------------------

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  const { id } = await params;

  try {
    const property = await prisma.property.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, name: true, email: true, phone: true } },
        rooms: {
          orderBy: { sortOrder: "asc" },
        },
        jobs: {
          take: 10,
          orderBy: { scheduledDate: "desc" },
          include: {
            assignments: {
              include: {
                user: { select: { id: true, name: true } },
              },
            },
          },
        },
        checklists: {
          where: { isActive: true },
          include: { items: { orderBy: { sortOrder: "asc" } } },
          orderBy: { sortOrder: "asc" },
        },
        propertyNotes: {
          take: 20,
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!property) return notFound("Property not found");

    return success(property);
  } catch (err) {
    console.error("[GET /api/properties/[id]]", err);
    return error("Failed to fetch property", 500);
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/properties/[id] — Update property
// ---------------------------------------------------------------------------

const updatePropertySchema = z.object({
  name: z.string().min(1).optional(),
  code: z.string().min(1).optional(),
  address: z.string().nullable().optional(),
  ownerId: z.string().nullable().optional(),
  defaultJobFee: z.number().min(0).nullable().optional(),
  houseCutPercent: z.number().min(0).max(100).optional(),
  status: z.enum(["active", "inactive"]).optional(),
  accessInstructions: z.string().nullable().optional(),
  parkingNotes: z.string().nullable().optional(),
  wifiName: z.string().nullable().optional(),
  wifiPassword: z.string().nullable().optional(),
  trashDay: z.string().nullable().optional(),
  specialInstructions: z.string().nullable().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error("Invalid JSON body");
  }

  const parsed = updatePropertySchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const data = parsed.data;

  try {
    const existing = await prisma.property.findUnique({ where: { id } });
    if (!existing) return notFound("Property not found");

    // Check code uniqueness if changing
    if (data.code && data.code !== existing.code) {
      const codeExists = await prisma.property.findUnique({
        where: { code: data.code },
      });
      if (codeExists) return error("A property with this code already exists", 409);
    }

    // Validate owner if changing
    if (data.ownerId) {
      const owner = await prisma.propertyOwner.findUnique({
        where: { id: data.ownerId },
      });
      if (!owner) return error("Owner not found", 404);
    }

    const property = await prisma.property.update({
      where: { id },
      data,
      include: {
        owner: { select: { id: true, name: true } },
      },
    });

    await logAudit({
      userId: result.user.userId,
      action: "update",
      entityType: "property",
      entityId: id,
      summary: `Updated property ${property.name}`,
      details: { fields: Object.keys(data) },
    });

    return success(property);
  } catch (err) {
    console.error("[PATCH /api/properties/[id]]", err);
    return error("Failed to update property", 500);
  }
}
