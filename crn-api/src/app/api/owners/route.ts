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
        select: {
          id: true,
          name: true,
          code: true,
          defaultJobFee: true,
          houseCutPercent: true,
          status: true,
          address: true,
        },
      },
      _count: { select: { properties: true } },
    },
    orderBy: { name: "asc" },
  });

  // Map to V1-compatible shape
  const mapped = owners.map((o) => ({
    ...o,
    isActive: true, // V2 owners don't have a status field — all are active
    defaultBaseRate: o.properties[0]?.defaultJobFee ?? 0,
    properties: o.properties.map((p) => ({
      ...p,
      baseRate: p.defaultJobFee ?? 0,
      expensePercent: p.houseCutPercent ?? 0,
    })),
  }));

  return success(mapped);
}
