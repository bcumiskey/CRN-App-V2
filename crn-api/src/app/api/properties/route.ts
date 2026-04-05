import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { success, created, error, validationError } from "@/lib/responses";
import { z } from "zod";

// ---------------------------------------------------------------------------
// GET /api/properties — List properties
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  const params = request.nextUrl.searchParams;
  const status = params.get("status") || "active";
  const search = params.get("search");

  const where: Record<string, unknown> = {};

  if (status !== "all") {
    where.status = status;
  }

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { code: { contains: search, mode: "insensitive" } },
    ];
  }

  try {
    const properties = await prisma.property.findMany({
      where,
      include: {
        owner: { select: { id: true, name: true } },
      },
      orderBy: { name: "asc" },
    });

    return success({ properties });
  } catch (err) {
    console.error("[GET /api/properties]", err);
    return error("Failed to fetch properties", 500);
  }
}

// ---------------------------------------------------------------------------
// POST /api/properties — Create a property
// ---------------------------------------------------------------------------

const createPropertySchema = z.object({
  name: z.string().min(1, "Name is required"),
  code: z.string().min(1, "Code is required"),
  address: z.string().optional(),
  ownerId: z.string().optional(),
  defaultJobFee: z.number().min(0).optional(),
  houseCutPercent: z.number().min(0).max(100).optional(),
  accessInstructions: z.string().optional(),
  parkingNotes: z.string().optional(),
  wifiName: z.string().optional(),
  wifiPassword: z.string().optional(),
  trashDay: z.string().optional(),
  specialInstructions: z.string().optional(),
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

  const parsed = createPropertySchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const data = parsed.data;

  try {
    // Check for duplicate code
    const existing = await prisma.property.findUnique({
      where: { code: data.code },
    });
    if (existing) return error("A property with this code already exists", 409);

    // Validate owner if provided
    if (data.ownerId) {
      const owner = await prisma.propertyOwner.findUnique({
        where: { id: data.ownerId },
      });
      if (!owner) return error("Owner not found", 404);
    }

    const property = await prisma.property.create({
      data,
      include: {
        owner: { select: { id: true, name: true } },
      },
    });

    await logAudit({
      userId: result.user.userId,
      action: "create",
      entityType: "property",
      entityId: property.id,
      summary: `Created property ${data.name} (${data.code})`,
    });

    return created(property);
  } catch (err) {
    console.error("[POST /api/properties]", err);
    return error("Failed to create property", 500);
  }
}
