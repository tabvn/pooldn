import bcrypt from "bcryptjs";
import type { Prisma, PrismaClient, User } from "@/lib/generated/prisma/client";

const BCRYPT_ROUNDS = 10;

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
