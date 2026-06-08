import bcrypt from "bcryptjs";
import type { Prisma, PrismaClient, User } from "@/lib/generated/prisma/client";

const BCRYPT_ROUNDS = 10;

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
    data: { ...input, password },
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
