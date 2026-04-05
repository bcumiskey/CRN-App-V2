import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { success, created, error, notFound, validationError } from "@/lib/responses";
import { z } from "zod";

// ---------------------------------------------------------------------------
// GET /api/properties/[id]/rooms — List rooms for a property
// ---------------------------------------------------------------------------

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  const { id } = await params;

  try {
    const property = await prisma.property.findUnique({ where: { id } });
    if (!property) return notFound("Property not found");

    const rooms = await prisma.room.findMany({
      where: { propertyId: id },
      orderBy: { sortOrder: "asc" },
    });

    return success({ rooms });
  } catch (err) {
    console.error("[GET /api/properties/[id]/rooms]", err);
    return error("Failed to fetch rooms", 500);
  }
}

// ---------------------------------------------------------------------------
// POST /api/properties/[id]/rooms — Create a room
// ---------------------------------------------------------------------------

const createRoomSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.string().min(1, "Type is required"),
  floor: z.string().optional(),
  bedType: z.string().optional(),
  bedCount: z.number().int().min(0).optional(),
  hasCrib: z.boolean().optional(),
  hasMurphy: z.boolean().optional(),
  hasTrundle: z.boolean().optional(),
  hasPullout: z.boolean().optional(),
  towelCount: z.number().int().min(0).optional(),
  hasRug: z.boolean().optional(),
  hasRobes: z.boolean().optional(),
  hasSlippers: z.boolean().optional(),
  stockingNotes: z.string().optional(),
  sortOrder: z.number().int().optional(),
});

export async function POST(
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

  const parsed = createRoomSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  try {
    const property = await prisma.property.findUnique({ where: { id } });
    if (!property) return notFound("Property not found");

    const room = await prisma.room.create({
      data: {
        propertyId: id,
        ...parsed.data,
      },
    });

    return created(room);
  } catch (err) {
    console.error("[POST /api/properties/[id]/rooms]", err);
    return error("Failed to create room", 500);
  }
}
