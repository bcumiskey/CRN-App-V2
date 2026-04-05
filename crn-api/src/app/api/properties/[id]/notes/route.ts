import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { success, created, error, notFound, validationError } from "@/lib/responses";
import { z } from "zod";

// ---------------------------------------------------------------------------
// GET /api/properties/[id]/notes — List notes for a property
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

    const notes = await prisma.propertyNote.findMany({
      where: { propertyId: id },
      orderBy: { createdAt: "desc" },
    });

    // Fetch author names for all notes
    const authorIds = [...new Set(notes.map((n) => n.authorId))];
    const authors = await prisma.user.findMany({
      where: { id: { in: authorIds } },
      select: { id: true, name: true },
    });
    const authorMap = new Map(authors.map((a) => [a.id, a.name]));

    const notesWithAuthor = notes.map((note) => ({
      ...note,
      authorName: authorMap.get(note.authorId) ?? "Unknown",
    }));

    return success({ notes: notesWithAuthor });
  } catch (err) {
    console.error("[GET /api/properties/[id]/notes]", err);
    return error("Failed to fetch notes", 500);
  }
}

// ---------------------------------------------------------------------------
// POST /api/properties/[id]/notes — Create a note
// ---------------------------------------------------------------------------

const createNoteSchema = z.object({
  content: z.string().min(1, "Content is required"),
  authorId: z.string().min(1, "Author ID is required"),
  noteType: z
    .enum(["general", "damage", "maintenance", "owner_request"])
    .default("general"),
  photoUrl: z.string().url().optional(),
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

  const parsed = createNoteSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const data = parsed.data;

  try {
    const property = await prisma.property.findUnique({ where: { id } });
    if (!property) return notFound("Property not found");

    const author = await prisma.user.findUnique({
      where: { id: data.authorId },
      select: { id: true, name: true },
    });
    if (!author) return error("Author not found", 404);

    const note = await prisma.propertyNote.create({
      data: {
        propertyId: id,
        authorId: data.authorId,
        content: data.content,
        noteType: data.noteType,
        photoUrl: data.photoUrl,
      },
    });

    return created({
      ...note,
      authorName: author.name,
    });
  } catch (err) {
    console.error("[POST /api/properties/[id]/notes]", err);
    return error("Failed to create note", 500);
  }
}
