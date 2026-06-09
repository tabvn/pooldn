# PoolDN — Round 42 (CORRECTED / RESOLVED): GraphQL 500 was transient, NOT `yoga.handle`

## Correction
My original round-42 claimed the GraphQL endpoint 500 was caused by `yoga.handle` being undefined (recommending `yoga.handleRequest`). **That diagnosis was wrong.** Verified afterward: the endpoint returns 200 with `yoga.handle(...)` still in `app/api/graphql/route.ts`, so `yoga.handle` is a valid method in this graphql-yoga version. **Do NOT change `yoga.handle` to `handleRequest`.**

## Actual root cause
The endpoint 500'd on every operation only *transiently*, while the AI was mid-editing the new subscription wiring (`builder.subscriptionType`, `resolvers/subscriptions.ts`, `pubsub.ts`, `builder.ts`). During that window `schema.toSchema()` (or the Yoga handler init) threw at request time, so every request — even `{ __typename }` — returned an empty 500. A dev-server restart / completing the edits cleared it. Same class of issue as the earlier `./resolvers/search` wedge: a half-written module in the schema import graph takes the whole endpoint down until it compiles cleanly.

## Status: RESOLVED
Endpoint now returns 200; login + all data work; the AI also added a correct set-cookie fix ("Round-45") so login cookies aren't corrupted when two `set-cookie` rows are joined.

## Prevention (still worth doing)
When adding a new module to the schema import graph (resolvers/types/builder), create the file (even a stub) before importing it, and avoid leaving the schema in a non-compiling state — otherwise the entire `/api/graphql` endpoint 500s app-wide, not just the new feature.
