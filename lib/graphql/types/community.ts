import { builder } from "../builder";

builder.prismaObject("CommunityPost", {
  fields: (t) => ({
    id: t.exposeID("id"),
    body: t.exposeString("body"),
    author: t.relation("author"),
    city: t.relation("city", { nullable: true }),
    createdAt: t.expose("createdAt", { type: "DateTime" }),
  }),
});

export const CreatePostInput = builder.inputType("CreatePostInput", {
  fields: (t) => ({
    body: t.string({ required: true }),
    cityId: t.id(),
  }),
});
