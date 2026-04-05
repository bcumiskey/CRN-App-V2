import { prisma } from "@/lib/prisma";
import { success, error } from "@/lib/responses";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return success({
      status: "ok",
      timestamp: new Date().toISOString(),
      database: "connected",
    });
  } catch {
    return error("Database connection failed", 503);
  }
}
