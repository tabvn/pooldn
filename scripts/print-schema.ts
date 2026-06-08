import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { printSchema, lexicographicSortSchema } from "graphql";
import { schema } from "../lib/graphql/schema";

const outPath = resolve(process.cwd(), "lib/graphql/schema.graphql");
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, printSchema(lexicographicSortSchema(schema)));
console.log(`wrote SDL → ${outPath}`);
