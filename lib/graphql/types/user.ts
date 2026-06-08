import { builder } from "../builder";
import { UserRoleEnum } from "./enums";

export const UserType = builder.prismaObject("User", {
  description: "Application user.",
  fields: (t) => ({
    id: t.exposeID("id"),
    name: t.exposeString("name"),
    username: t.exposeString("username"),
    email: t.exposeString("email"),
    role: t.expose("role", { type: UserRoleEnum }),
    avatarUrl: t.exposeString("avatarUrl", { nullable: true }),
    bio: t.exposeString("bio", { nullable: true }),
    nationality: t.exposeString("nationality", { nullable: true }),
    phone: t.exposeString("phone", { nullable: true }),
    city: t.relation("city", { nullable: true }),
    isActive: t.exposeBoolean("isActive"),
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
    username: t.string({ required: true }),
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
