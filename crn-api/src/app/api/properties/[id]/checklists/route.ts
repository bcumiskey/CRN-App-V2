import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { success, created, error, notFound, validationError } from "@/lib/responses";
import { z } from "zod";

// ---------------------------------------------------------------------------
// GET /api/properties/[id]/checklists — List checklists for a property
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

    const checklists = await prisma.checklist.findMany({
      where: { propertyId: id },
      include: {
        items: {
          orderBy: { sortOrder: "asc" },
        },
        _count: { select: { items: true } },
      },
      orderBy: { sortOrder: "asc" },
    });

    return success({ checklists });
  } catch (err) {
    console.error("[GET /api/properties/[id]/checklists]", err);
    return error("Failed to fetch checklists", 500);
  }
}

// ---------------------------------------------------------------------------
// POST /api/properties/[id]/checklists — Create a checklist
// ---------------------------------------------------------------------------

const checklistItemSchema = z.object({
  text: z.string().min(1, "Item text is required"),
  room: z.string().optional(),
  sortOrder: z.number().int().optional(),
  isRequired: z.boolean().default(true),
});

const createChecklistSchema = z.object({
  name: z.string().min(1, "Name is required"),
  jobType: z.string().optional(),
  items: z.array(checklistItemSchema).optional(),
  isActive: z.boolean().default(true),
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

  const parsed = createChecklistSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const data = parsed.data;

  try {
    const property = await prisma.property.findUnique({ where: { id } });
    if (!property) return notFound("Property not found");

    // Default sortOrder to end of list
    let sortOrder = data.sortOrder;
    if (sortOrder === undefined) {
      const maxSort = await prisma.checklist.aggregate({
        where: { propertyId: id },
        _max: { sortOrder: true },
      });
      sortOrder = (maxSort._max.sortOrder ?? -1) + 1;
    }

    // Create checklist + items in a transaction
    const checklist = await prisma.$transaction(async (tx) => {
      const cl = await tx.checklist.create({
        data: {
          propertyId: id,
          name: data.name,
          jobType: data.jobType,
          isActive: data.isActive,
          sortOrder,
        },
      });

      if (data.items && data.items.length > 0) {
        await tx.checklistItem.createMany({
          data: data.items.map((item, index) => ({
            checklistId: cl.id,
            text: item.text,
            room: item.room,
            sortOrder: item.sortOrder ?? index,
            isRequired: item.isRequired,
          })),
        });
      }

      return tx.checklist.findUnique({
        where: { id: cl.id },
        include: {
          items: { orderBy: { sortOrder: "asc" } },
          _count: { select: { items: true } },
        },
      });
    });

    await logAudit({
      userId: result.user.userId,
      action: "create",
      entityType: "checklist",
      entityId: checklist!.id,
      summary: `Created checklist "${data.name}" for property ${property.name}`,
      details: { propertyId: id, itemCount: data.items?.length ?? 0 },
    });

    return created(checklist);
  } catch (err) {
    console.error("[POST /api/properties/[id]/checklists]", err);
    return error("Failed to create checklist", 500);
  }
}
