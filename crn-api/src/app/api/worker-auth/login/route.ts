import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { success, error, validationError } from "@/lib/responses";
import {
  hashPassword,
  signWorkerToken,
  verifyPassword,
  workerSessionSecret,
} from "@/lib/worker-auth";
import { z } from "zod";

// ---------------------------------------------------------------------------
// POST /api/worker-auth/login — Worker portal login
//
// Deliberately NOT behind requireAuth: this route IS the auth entry point.
// Returns the same 401 body for every failure shape (unknown email, inactive
// user, no portal password set, wrong password) so responses never leak
// which accounts exist or have portal access. Every failure also waits a
// small constant delay to blunt online brute-force attempts — a real
// rate limiter (per-IP, at the edge) would be stronger; this is a
// deliberately simple mitigation, not a substitute.
// ---------------------------------------------------------------------------

const INVALID_CREDENTIALS = "Invalid email or password";
const FAILURE_DELAY_MS = 150;

// Dummy hash (computed once at module load) so failure paths that have no
// stored hash still burn a full scrypt verification — response timing cannot
// distinguish "unknown email / no portal password" from "wrong password".
const DUMMY_HASH = hashPassword("dummy-timing-equalizer");

const loginSchema = z.object({
  email: z.string().min(1, "Email is required"),
  password: z.string().min(1, "Password is required"),
});

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Uniform failure: constant delay + the one shared 401 message. */
async function invalidCredentials(): Promise<Response> {
  await sleep(FAILURE_DELAY_MS);
  return error(INVALID_CREDENTIALS, 401);
}

export async function POST(request: NextRequest) {
  // Env-gated: with no signing secret configured, worker login is off and
  // production behavior is unchanged.
  if (!workerSessionSecret()) {
    return error("Worker login is not configured", 503);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error("Invalid JSON body");
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const { email, password } = parsed.data;

  try {
    // Case-insensitive email match; only active users may log in.
    const user = await prisma.user.findFirst({
      where: {
        email: { equals: email, mode: "insensitive" },
        status: "active",
      },
    });

    // A user without a passwordHash gets the same 401 as an unknown email —
    // do not leak which accounts have portal access. Verify against a dummy
    // hash in that case so every failure path costs the same scrypt work.
    if (!user?.passwordHash) {
      verifyPassword(password, DUMMY_HASH);
      return invalidCredentials();
    }
    if (!verifyPassword(password, user.passwordHash)) {
      return invalidCredentials();
    }

    const token = signWorkerToken(user.id);
    if (!token) {
      // Secret disappeared between the guard above and signing — treat as
      // unconfigured rather than mint an unverifiable token.
      return error("Worker login is not configured", 503);
    }

    await logAudit({
      userId: user.id,
      action: "login",
      entityType: "user",
      entityId: user.id,
      summary: `Worker portal login: ${user.name}`,
    });

    return success({
      token,
      user: {
        userId: user.id,
        name: user.name,
        role: user.role,
        isOwner: user.isOwner,
      },
    });
  } catch (err) {
    console.error("[POST /api/worker-auth/login]", err);
    return error("Failed to log in", 500);
  }
}
