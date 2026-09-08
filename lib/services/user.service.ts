import bcrypt from "bcryptjs";
import type { Prisma, PrismaClient, User } from "@/lib/generated/prisma/client";

const BCRYPT_ROUNDS = 10;

/**
 * Round-78 — username length bounds, in one place so the GraphQL validator,
 * the live-availability check, the settings form and the two auto-generators
 * (OAuth sign-up, offline-league shell import) can't drift apart.
 *
 * The minimum was 3 and is now 4. Existing shorter usernames are left alone —
 * validation only runs when a username is created or changed, so the nine
 * seeded 3-character accounts keep working; they'd only be asked to pick a
 * longer one if they ever edit it.
 */
export const USERNAME_MIN_LENGTH = 4;
export const USERNAME_MAX_LENGTH = 24;

/**
 * Pads an auto-generated username up to the minimum. Generators derive the
 * slug from a display name, so a two-letter name would otherwise produce a
 * username the rules would reject on any later edit. Trailing digits keep the
 * result matching the format regex (must end alphanumeric).
 */
export function padUsernameToMinimum(base: string): string {
  if (base.length >= USERNAME_MIN_LENGTH) return base;
  return base.padEnd(USERNAME_MIN_LENGTH, "0");
}

/**
 * Every user must carry a location (city) and a country of origin
 * (nationality) — both are required. New accounts default to the app's home
 * city (Da Nang) and that city's country until the user sets their own in
 * onboarding (later: geolocation). Falls back to any city so creation never
 * fails on a differently-seeded environment.
 */
export async function defaultUserLocation(
  prisma: PrismaClient,
): Promise<{ cityId: string; nationality: string }> {
  const select = {
    id: true,
    country: { select: { code: true } },
  } as const;
  const home =
    (await prisma.city.findFirst({ where: { name: "Da Nang" }, select })) ??
    (await prisma.city.findFirst({ select }));
  if (!home) {
    throw new Error("No city exists to assign a new user to.");
  }
  return { cityId: home.id, nationality: home.country?.code ?? "VN" };
}

export type CreateUserArgs = {
  name: string;
  username: string;
  email: string;
  password: string;
};

export async function createUser(
  prisma: PrismaClient,
  input: CreateUserArgs,
  select?: Prisma.UserSelect,
): Promise<User> {
  const password = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  return prisma.user.create({
    data: { ...input, password, ...(await defaultUserLocation(prisma)) },
    ...(select ? { select } : {}),
  }) as Promise<User>;
}

export function findUserById(
  prisma: PrismaClient,
  id: string,
  select?: Prisma.UserSelect,
): Promise<User | null> {
  return prisma.user.findUnique({
    where: { id },
    ...(select ? { select } : {}),
  }) as Promise<User | null>;
}
