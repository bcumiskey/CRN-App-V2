import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { success, error, notFound, validationError } from "@/lib/responses";
import { z } from "zod";

// ---------------------------------------------------------------------------
// POST /api/worker/notes — Worker creates a property note
// ---------------------------------------------------------------------------

const createNoteSchema = z.object({
  propertyId: z.string().min(1, "propertyId is required"),
  content: z.string().min(1, "Content is required"),
  noteType: z
    .enum(["general", "damage", "maintenance", "owner_request"])
    .default("general"),
  photoUrl: z.string().url().optional(),
});

export async function POST(request: NextRequest) {
  const result = await requireAuth(request);
  if (result.error) return result.error;

  const { user } = result;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error("Invalid JSON body");
  }

  const parsed = createNoteSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const { propertyId, content, noteType, photoUrl } = parsed.data;

  try {
    // Scoping: worker must have been assigned to this property
    const hasAssignment = await prisma.jobAssignment.findFirst({
      where: {
        userId: user.userId,
        job: { propertyId },
      },
      select: { id: true },
    });

    if (!hasAssignment) return notFound("Property not found");

    // Verify property exists
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      select: { id: true },
    });
    if (!property) return notFound("Property not found");

    const note = await prisma.propertyNote.create({
      data: {
        propertyId,
        authorId: user.userId,
        content,
        noteType,
        photoUrl,
      },
    });

    return success(
      {
        ...note,
        authorName: user.name,
      },
      201
    );
  } catch (err) {
    console.error("[POST /api/worker/notes]", err);
    return error("Failed to create note", 500);
  }
}
