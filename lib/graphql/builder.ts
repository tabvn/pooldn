import SchemaBuilder from "@pothos/core";
import PrismaPlugin from "@pothos/plugin-prisma";
import { DateTimeResolver } from "graphql-scalars";
import { prisma } from "@/lib/prisma";
import { getDatamodel } from "@/lib/generated/pothos-types";
import type PrismaTypes from "@/lib/generated/pothos-types";
import type { GraphQLContext } from "./context";

export const builder = new SchemaBuilder<{
  Defaults: "v3";
  Context: GraphQLContext;
  PrismaTypes: PrismaTypes;
  Scalars: {
    DateTime: { Input: Date; Output: Date };
    ID: { Input: string; Output: string };
  };
}>({
  defaults: "v3",
  plugins: [PrismaPlugin],
  prisma: {
    client: () => prisma,
    dmmf: getDatamodel(),
    exposeDescriptions: true,
    filterConnectionTotalCount: true,
  },
});

builder.addScalarType("DateTime", DateTimeResolver);

builder.queryType({});
builder.mutationType({});
