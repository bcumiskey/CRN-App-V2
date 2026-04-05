import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { success } from "@/lib/responses";

export async function GET(request: NextRequest) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  const owners = await prisma.propertyOwner.findMany({
    include: {
      properties: {
        where: { status: "active" },
        select: { id: true, name: true, code: true },
      },
    },
    orderBy: { name: "asc" },
  });

  return success(owners);
}
