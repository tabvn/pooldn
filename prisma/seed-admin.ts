/**
 * Admin-only bootstrap — the production counterpart to `prisma/seed.ts`.
 *
 * `seed.ts` builds the full demo Poolhub (venues, teams, fixtures, five
 * roles' worth of accounts). Production must not have any of that, so this
 * script creates the bare minimum a usable install needs:
 *
 *   - one Country + one City   (User.cityId is required, and the header city
 *     selector auto-pins when exactly one active city exists — so a single
 *     city is the correct production starting state, not a limitation)
 *   - one SUPER_ADMIN account
 *
 * Everything else — venues, competitions, players — is created through the
 * app by that admin.
 *
 * Idempotent: safe to run on every container start. The password is only
 * written on first creation unless ADMIN_FORCE_PASSWORD=true, so restarting
 * the stack never resets a password the admin has changed in-app.
 */
import { PrismaClient } from "../lib/generated/prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const BCRYPT_ROUNDS = 10;

const ADMIN_USERNAME = process.env.ADMIN_USERNAME ?? "admin";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@pooldn.com";
const ADMIN_NAME = process.env.ADMIN_NAME ?? "PoolDN Admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "";
const ADMIN_NATIONALITY = process.env.ADMIN_NATIONALITY ?? "VN";
const FORCE_PASSWORD = process.env.ADMIN_FORCE_PASSWORD === "true";

const COUNTRY_CODE = process.env.SEED_COUNTRY_CODE ?? "VN";
const COUNTRY_NAME = process.env.SEED_COUNTRY_NAME ?? "Vietnam";
const CITY_NAME = process.env.SEED_CITY_NAME ?? "Da Nang";

async function main() {
  if (!ADMIN_PASSWORD) {
    throw new Error(
      "ADMIN_PASSWORD is not set — refusing to create an admin account with a blank or guessable password.",
    );
  }

  const country = await prisma.country.upsert({
    where: { code: COUNTRY_CODE },
    update: { name: COUNTRY_NAME },
    create: { code: COUNTRY_CODE, name: COUNTRY_NAME },
  });

  const city = await prisma.city.upsert({
    where: { countryId_name: { countryId: country.id, name: CITY_NAME } },
    update: { isActive: true },
    create: { name: CITY_NAME, countryId: country.id, isActive: true },
  });

  const password = await bcrypt.hash(ADMIN_PASSWORD, BCRYPT_ROUNDS);

  const existing = await prisma.user.findUnique({
    where: { username: ADMIN_USERNAME },
    select: { id: true },
  });

  const admin = await prisma.user.upsert({
    where: { username: ADMIN_USERNAME },
    update: {
      name: ADMIN_NAME,
      email: ADMIN_EMAIL,
      role: "SUPER_ADMIN",
      cityId: city.id,
      nationality: ADMIN_NATIONALITY,
      isActive: true,
      isShell: false,
      bannedAt: null,
      banReason: null,
      // Only overwrite an existing hash on an explicit opt-in.
      ...(FORCE_PASSWORD ? { password } : {}),
    },
    create: {
      name: ADMIN_NAME,
      username: ADMIN_USERNAME,
      email: ADMIN_EMAIL,
      password,
      role: "SUPER_ADMIN",
      cityId: city.id,
      nationality: ADMIN_NATIONALITY,
      emailVerified: true,
    },
  });

  const verb = existing ? (FORCE_PASSWORD ? "updated (password reset)" : "updated") : "created";
  console.log(`seed-admin: city ${city.name}, ${COUNTRY_CODE} (${city.id})`);
  console.log(`seed-admin: SUPER_ADMIN @${admin.username} <${admin.email}> ${verb}`);

  const others = await prisma.user.count({ where: { id: { not: admin.id } } });
  if (others > 0) {
    console.log(`seed-admin: ${others} other user account(s) already present — left untouched.`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
