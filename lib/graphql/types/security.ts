import { builder } from "../builder";

builder.prismaObject("SecurityEvent", {
  fields: (t) => ({
    id: t.exposeID("id"),
    kind: t.exposeString("kind"),
    identifier: t.exposeString("identifier", { nullable: true }),
    ip: t.exposeString("ip", { nullable: true }),
    country: t.exposeString("country", { nullable: true }),
    note: t.exposeString("note", { nullable: true }),
    createdAt: t.expose("createdAt", { type: "DateTime" }),
    user: t.relation("user", { nullable: true }),
  }),
});
