import type { PrismaClient } from "@/lib/generated/prisma/client";
import { getClientIp, getCountry } from "./client-ip";

/**
 * Round-47 — fire-and-forget security event logger.
 *
 * Never throws — a failed insert here must NEVER break the request flow.
 * `kind` is a free string per the SecurityEvent.kind union in schema.prisma.
 */
export function logSecurityEvent(
  prisma: PrismaClient,
  req: Request,
  data: {
    kind: string;
    userId?: string | null;
    identifier?: string | null;
    note?: string | null;
  },
): void {
  const ip = getClientIp(req);
  const country = getCountry(req);
  void prisma.securityEvent
    .create({
      data: {
        userId: data.userId ?? null,
        kind: data.kind,
        identifier: data.identifier ?? null,
        ip,
        country,
        note: data.note ?? null,
      },
    })
    .catch((e) => {
      console.warn("[security-event] insert failed:", e);
    });
}
