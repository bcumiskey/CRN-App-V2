import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { success, created, error, validationError } from "@/lib/responses";
import { z } from "zod";

// ---------------------------------------------------------------------------
// GET /api/team — List team members
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  const params = request.nextUrl.searchParams;
  const status = params.get("status") || "default";

  const where: Record<string, unknown> = {};

  if (status === "default") {
    where.status = { in: ["active", "lame_duck"] };
  } else if (status !== "all") {
    where.status = status;
  }

  try {
    const members = await prisma.user.findMany({
      where,
      orderBy: [
        { status: "asc" }, // active < archived < lame_duck alphabetically, but we sort manually below
        { name: "asc" },
      ],
    });

    // Custom sort: active first, then lame_duck, alphabetical within each
    const statusOrder: Record<string, number> = {
      active: 0,
      lame_duck: 1,
      archived: 2,
    };

    const sorted = members.sort((a, b) => {
      const sa = statusOrder[a.status] ?? 99;
      const sb = statusOrder[b.status] ?? 99;
      if (sa !== sb) return sa - sb;
      return a.name.localeCompare(b.name);
    });

    return success({ members: sorted });
  } catch (err) {
    console.error("[GET /api/team]", err);
    return error("Failed to fetch team members", 500);
  }
}

// ---------------------------------------------------------------------------
// POST /api/team — Create a team member
// ---------------------------------------------------------------------------

const createMemberSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email is required"),
  clerkId: z.string().optional(),
  phone: z.string().optional(),
  role: z.enum(["admin", "worker"]).default("worker"),
  defaultShare: z.number().min(0).optional(),
  isOwner: z.boolean().optional(),
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

  const parsed = createMemberSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const data = parsed.data;

  try {
    // Check for duplicate email
    const existing = await prisma.user.findUnique({
      where: { email: data.email },
    });
    if (existing) return error("A team member with this email already exists", 409);

    // Use provided clerkId or generate a placeholder for dev bypass
    const clerkId = data.clerkId || `pending_${data.email}`;

    const member = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        clerkId,
        phone: data.phone,
        role: data.role,
        defaultShare: data.defaultShare,
        isOwner: data.isOwner,
      },
    });

    await logAudit({
      userId: result.user.userId,
      action: "create",
      entityType: "user",
      entityId: member.id,
      summary: `Created team member ${data.name} (${data.email})`,
    });

    return created(member);
  } catch (err) {
    console.error("[POST /api/team]", err);
    return error("Failed to create team member", 500);
  }
}
