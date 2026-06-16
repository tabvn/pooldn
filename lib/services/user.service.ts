import bcrypt from "bcryptjs";
import type { Prisma, PrismaClient, User } from "@/lib/generated/prisma/client";

const BCRYPT_ROUNDS = 10;

/**
 * Every user must be tied to a location (city is the app's top-level content
 * filter). New accounts default to the app's home city — Da Nang — until the
 * user sets their own in onboarding (later: geolocation). Falls back to any
 * city so creation never fails on a differently-seeded environment.
 */
export async function defaultCityId(prisma: PrismaClient): Promise<string> {
  const home =
    (await prisma.city.findFirst({
      where: { name: "Da Nang" },
      select: { id: true },
    })) ?? (await prisma.city.findFirst({ select: { id: true } }));
  if (!home) {
    throw new Error("No city exists to assign a new user to.");
  }
  return home.id;
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
    data: { ...input, password, cityId: await defaultCityId(prisma) },
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

export function findUserByUsername(
  prisma: PrismaClient,
  username: string,
  select?: Prisma.UserSelect,
): Promise<User | null> {
  return prisma.user.findUnique({
    where: { username },
    ...(select ? { select } : {}),
  }) as Promise<User | null>;
}

export function listUsers(
  prisma: PrismaClient,
  select?: Prisma.UserSelect,
): Promise<User[]> {
  return prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    ...(select ? { select } : {}),
  }) as Promise<User[]>;
}
