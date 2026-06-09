import { builder } from "../builder";
import { UserRoleEnum } from "./enums";

export const UserType = builder.prismaObject("User", {
  description: "Application user.",
  fields: (t) => ({
    id: t.exposeID("id"),
    name: t.exposeString("name"),
    username: t.exposeString("username"),
    email: t.exposeString("email"),
    emailVerified: t.exposeBoolean("emailVerified"),
    role: t.expose("role", { type: UserRoleEnum }),
    avatarUrl: t.exposeString("avatarUrl", { nullable: true }),
    bio: t.exposeString("bio", { nullable: true }),
    nationality: t.exposeString("nationality", { nullable: true }),
    phone: t.exposeString("phone", { nullable: true }),
    city: t.relation("city", { nullable: true }),
    isActive: t.exposeBoolean("isActive"),
    bannedAt: t.expose("bannedAt", { type: "DateTime", nullable: true }),
    banReason: t.exposeString("banReason", { nullable: true }),
    rating: t.exposeInt("rating"),
    level: t.exposeInt("level"),
    // Round-X — player landing surfaces.
    rank: t.int({
      nullable: true,
      description:
        "1-indexed rank among active PLAYER/TEAM_CAPTAIN users by rating DESC. Null if the viewer isn't ranked (rating-tied users disambiguate by id).",
      resolve: async (u, _args, ctx) => {
        if (u.role !== "PLAYER" && u.role !== "TEAM_CAPTAIN") return null;
        if (!u.isActive) return null;
        const ahead = await ctx.prisma.user.count({
          where: {
            isActive: true,
            role: { in: ["PLAYER", "TEAM_CAPTAIN"] },
            OR: [
              { rating: { gt: u.rating } },
              { rating: u.rating, id: { lt: u.id } },
            ],
          },
        });
        return ahead + 1;
      },
    }),
    playerCompStats: t.relation("playerCompStats", {
      query: () => ({
        orderBy: { id: "desc" },
      }),
    }),
    createdAt: t.expose("createdAt", { type: "DateTime" }),
    updatedAt: t.expose("updatedAt", { type: "DateTime" }),
  }),
});

export const CreateUserInput = builder.inputType("CreateUserInput", {
  fields: (t) => ({
    name: t.string({ required: true }),
    username: t.string({ required: true }),
    email: t.string({ required: true }),
    password: t.string({ required: true }),
  }),
});

export const RegisterInput = builder.inputType("RegisterInput", {
  fields: (t) => ({
    name: t.string({ required: true }),
    // Username is optional — when omitted (or already taken) the server
    // auto-generates one from the user's name with a numeric suffix until it
    // finds a free slot. Clients that want full control can still send it.
    username: t.string(),
    email: t.string({ required: true }),
    password: t.string({ required: true }),
  }),
});

export const UpdateProfileInput = builder.inputType("UpdateProfileInput", {
  fields: (t) => ({
    name: t.string(),
    bio: t.string(),
    nationality: t.string(),
    phone: t.string(),
    avatarUrl: t.string(),
    cityId: t.id(),
  }),
});

export const LoginInput = builder.inputType("LoginInput", {
  fields: (t) => ({
    usernameOrEmail: t.string({ required: true }),
    password: t.string({ required: true }),
  }),
});

export const AuthPayload = builder.objectRef<{
  token: string;
  user: { id: string };
}>("AuthPayload").implement({
  fields: (t) => ({
    token: t.exposeString("token"),
    user: t.prismaField({
      type: "User",
      resolve: (query, parent, _args, ctx) =>
        ctx.prisma.user.findUniqueOrThrow({
          ...query,
          where: { id: parent.user.id },
        }),
    }),
  }),
});
