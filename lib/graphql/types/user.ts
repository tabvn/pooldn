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
    // Round-54 — rating / level / ratingHistory / rank deleted with the
    // rating system. Bring back a points field here when the new model
    // lands.
    playerCompStats: t.relation("playerCompStats", {
      query: () => ({
        orderBy: { id: "desc" },
      }),
    }),
    // Round-49 — teams the player belongs to (member or captain). Used by
    // the rankings list to surface team affiliations on each row. Bounded
    // by `limit` so a player in many teams doesn't blow up the payload;
    // `teamsCount` lets the UI render a "+N more" pill.
    teams: t.prismaField({
      type: ["Team"],
      description:
        "Teams the user belongs to (captain or member), sorted by name.",
      args: { limit: t.arg.int() },
      resolve: async (query, u, args, ctx) => {
        const take = Math.min(Math.max(args.limit ?? 10, 1), 50);
        return ctx.prisma.team.findMany({
          ...query,
          where: {
            OR: [
              { captainId: u.id },
              { members: { some: { userId: u.id } } },
            ],
          },
          orderBy: { name: "asc" },
          take,
        });
      },
    }),
    teamsCount: t.int({
      description: "Total team count for the user (captain + member).",
      resolve: (u, _args, ctx) =>
        ctx.prisma.team.count({
          where: {
            OR: [
              { captainId: u.id },
              { members: { some: { userId: u.id } } },
            ],
          },
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
