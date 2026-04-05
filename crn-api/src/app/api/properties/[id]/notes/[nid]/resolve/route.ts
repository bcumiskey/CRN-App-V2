import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { success, error, notFound, validationError } from "@/lib/responses";
import { z } from "zod";

// ---------------------------------------------------------------------------
// PATCH /api/properties/[id]/notes/[nid]/resolve — Mark note as resolved
// ---------------------------------------------------------------------------

const resolveSchema = z.object({
  resolutionNote: z.string().min(1, "Resolution note is required"),
  resolvedById: z.string().min(1, "Resolved by user ID is required"),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; nid: string }> }
) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  const { id, nid } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error("Invalid JSON body");
  }

  const parsed = resolveSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const { resolutionNote, resolvedById } = parsed.data;

  try {
    const note = await prisma.propertyNote.findFirst({
      where: { id: nid, propertyId: id },
    });
    if (!note) return notFound("Note not found");

    if (note.isResolved) {
      return error("Note is already resolved");
    }

    // Verify the resolver user exists
    const resolver = await prisma.user.findUnique({
      where: { id: resolvedById },
      select: { id: true, name: true },
    });
    if (!resolver) return notFound("Resolver user not found");

    // Update original note + create linked resolution note in a transaction
    const [updatedNote, resolutionNoteRecord] = await prisma.$transaction(
      async (tx) => {
        // Mark original note as resolved
        const updated = await tx.propertyNote.update({
          where: { id: nid },
          data: {
            isResolved: true,
            resolvedAt: new Date(),
            resolvedById,
            resolutionNote,
          },
        });

        // Create a linked "resolved" type note referencing the original
        const linked = await tx.propertyNote.create({
          data: {
            propertyId: id,
            authorId: resolvedById,
            content: resolutionNote,
            noteType: "resolved",
            relatedNoteId: nid,
            isResolved: true,
            resolvedAt: new Date(),
            resolvedById,
          },
        });

        return [updated, linked] as const;
      }
    );

    await logAudit({
      userId: result.user.userId,
      action: "update",
      entityType: "property_note",
      entityId: nid,
      summary: `Resolved note on property`,
      details: {
        propertyId: id,
        resolvedById,
        resolutionNoteId: resolutionNoteRecord.id,
      },
    });

    return success({
      note: {
        ...updatedNote,
        resolverName: resolver.name,
      },
      resolutionNote: resolutionNoteRecord,
    });
  } catch (err) {
    console.error("[PATCH /api/properties/[id]/notes/[nid]/resolve]", err);
    return error("Failed to resolve note", 500);
  }
}
