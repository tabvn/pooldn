import { GraphQLError } from "graphql";
import bcrypt from "bcryptjs";
import type { PrismaClient, User } from "@/lib/generated/prisma/client";
import { signSessionToken } from "@/lib/auth/jwt";

const BCRYPT_ROUNDS = 10;

export async function registerUser(
  prisma: PrismaClient,
  input: {
    name: string;
    username: string;
    email: string;
    password: string;
  },
): Promise<{ user: User; token: string }> {
  const username = input.username.toLowerCase().trim();
  const email = input.email.toLowerCase().trim();

  const clash = await prisma.user.findFirst({
    where: { OR: [{ username }, { email }] },
    select: { username: true, email: true },
  });
  if (clash) {
    throw new GraphQLError(
      clash.username === username
        ? "Username already taken"
        : "Email already registered",
      { extensions: { code: "BAD_USER_INPUT" } },
    );
  }

  const password = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  const user = await prisma.user.create({
    data: { name: input.name, username, email, password, role: "PLAYER" },
  });
  const token = await signSessionToken({
    userId: user.id,
    username: user.username,
    role: user.role,
  });
  return { user, token };
}

export async function loginUser(
  prisma: PrismaClient,
  input: { usernameOrEmail: string; password: string },
): Promise<{ user: User; token: string }> {
  const candidate = input.usernameOrEmail.toLowerCase().trim();
  const user = await prisma.user.findFirst({
    where: { OR: [{ username: candidate }, { email: candidate }] },
  });
  if (!user || !user.isActive) {
    throw new GraphQLError("Invalid credentials", {
      extensions: { code: "UNAUTHORIZED" },
    });
  }
  const ok = await bcrypt.compare(input.password, user.password);
  if (!ok) {
    throw new GraphQLError("Invalid credentials", {
      extensions: { code: "UNAUTHORIZED" },
    });
  }
  const token = await signSessionToken({
    userId: user.id,
    username: user.username,
    role: user.role,
  });
  return { user, token };
}
