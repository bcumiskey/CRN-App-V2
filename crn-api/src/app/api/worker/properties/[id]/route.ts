import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { success, error, notFound } from "@/lib/responses";

type RouteContext = { params: Promise<{ id: string }> };

// ---------------------------------------------------------------------------
// GET /api/worker/properties/[id] — Property reference detail (scoped)
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest, { params }: RouteContext) {
  const result = await requireAuth(request);
  if (result.error) return result.error;

  const { user } = result;
  const { id: propertyId } = await params;

  try {
    // Scoping: worker must have at least one assignment at this property
    const hasAssignment = await prisma.jobAssignment.findFirst({
      where: {
        userId: user.userId,
        job: { propertyId },
      },
      select: { id: true },
    });

    if (!hasAssignment) return notFound();

    // Load property with operational data only
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      select: {
        id: true,
        name: true,
        address: true,
        accessInstructions: true,
        parkingNotes: true,
        wifiName: true,
        wifiPassword: true,
        trashDay: true,
        specialInstructions: true,
        rooms: {
          orderBy: { sortOrder: "asc" },
          select: {
            id: true,
            name: true,
            floor: true,
            type: true,
            bedType: true,
            bedCount: true,
            hasCrib: true,
            hasMurphy: true,
            hasTrundle: true,
            hasPullout: true,
            towelCount: true,
            hasRug: true,
            hasRobes: true,
            hasSlippers: true,
            stockingNotes: true,
            sortOrder: true,
          },
        },
      },
    });

    if (!property) return notFound();

    // EXCLUDE: defaultJobFee, houseCutPercent, owner info, billing type/frequency
    return success(property);
  } catch (err) {
    console.error("[GET /api/worker/properties/[id]]", err);
    return error("Failed to fetch property", 500);
  }
}
