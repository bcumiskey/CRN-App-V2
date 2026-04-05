import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { success, error, notFound, validationError } from "@/lib/responses";
import { z } from "zod";

// ---------------------------------------------------------------------------
// POST /api/properties/[id]/photos/reorder — Batch reorder photos
// ---------------------------------------------------------------------------

const reorderSchema = z.object({
  photoIds: z.array(z.string()).min(1, "At least one photo ID is required"),
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

  const parsed = reorderSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const { photoIds } = parsed.data;

  try {
    const property = await prisma.property.findUnique({ where: { id } });
    if (!property) return notFound("Property not found");

    // Verify all photos belong to this property
    const photos = await prisma.propertyPhoto.findMany({
      where: { propertyId: id, id: { in: photoIds } },
      select: { id: true },
    });

    if (photos.length !== photoIds.length) {
      return error("One or more photo IDs do not belong to this property");
    }

    // Update sort orders in a transaction
    await prisma.$transaction(
      photoIds.map((photoId, index) =>
        prisma.propertyPhoto.update({
          where: { id: photoId },
          data: { sortOrder: index },
        })
      )
    );

    return success({ message: "Photos reordered", count: photoIds.length });
  } catch (err) {
    console.error("[POST /api/properties/[id]/photos/reorder]", err);
    return error("Failed to reorder photos", 500);
  }
}
