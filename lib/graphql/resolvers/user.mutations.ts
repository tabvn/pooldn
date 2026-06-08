import { builder } from "../builder";
import { CreateUserInput, UpdateProfileInput } from "../types/user";
import { createUser } from "@/lib/services/user.service";
import { requireUser } from "@/lib/casl/guard";

builder.mutationFields((t) => ({
  createUser: t.prismaField({
    type: "User",
    description: "Create a new user. Password is hashed with bcrypt.",
    args: {
      input: t.arg({ type: CreateUserInput, required: true }),
    },
    resolve: (query, _root, args, ctx) =>
      createUser(
        ctx.prisma,
        {
          name: args.input.name,
          username: args.input.username,
          email: args.input.email,
          password: args.input.password,
        },
        query.select,
      ),
  }),

  updateProfile: t.prismaField({
    type: "User",
    description: "Update the current viewer's own profile.",
    args: {
      input: t.arg({ type: UpdateProfileInput, required: true }),
    },
    resolve: (query, _root, args, ctx) => {
      requireUser(ctx.viewer);
      return ctx.prisma.user.update({
        ...query,
        where: { id: ctx.viewer.id },
        data: {
          name: args.input.name ?? undefined,
          bio: args.input.bio ?? undefined,
          nationality: args.input.nationality ?? undefined,
          phone: args.input.phone ?? undefined,
          avatarUrl: args.input.avatarUrl ?? undefined,
          cityId: args.input.cityId
            ? String(args.input.cityId)
            : args.input.cityId === null
              ? null
              : undefined,
        },
      });
    },
  }),
}));
