# PoolDN — P0: GraphQL endpoint 500s on EVERY operation (wrong Yoga method) (Round 42)

## Symptom
After switching `app/api/graphql/route.ts` to **graphql-yoga** (`createYoga`) for the new subscriptions, the GraphQL HTTP endpoint returns **HTTP 500 with an empty body on every request** — even `{ __typename }` and `{ viewer { id } }`. This takes down the **entire app's data layer**: login (demo quick-login + form) fails with `ServerError: Received status code 500`, and any client/SSR GraphQL call errors. The whole multi-role flow is blocked.

## Root cause
In `route.ts`:
```ts
async function handle(request: Request) {
  return yoga.handle(request, { responseHeaders: new Headers() }); // ❌ yoga.handle is undefined
}
```
The Yoga instance from `createYoga` has **no `handle` method**. Calling `yoga.handle(...)` throws `TypeError: yoga.handle is not a function`, which Next returns as an empty 500 before Yoga can format any GraphQL response.

## Fix
Use Yoga's Next.js App Router entry point — **`handleRequest`** (or call the instance's `fetch`):
```ts
async function handle(request: Request) {
  return yoga.handleRequest(request, { responseHeaders: new Headers() });
}
```
The idiomatic Yoga + Next App Router pattern is also acceptable:
```ts
const { handleRequest } = createYoga<ServerContext, GraphQLContext>({ schema, context: createContext, graphqlEndpoint: "/api/graphql", fetchAPI: { Response, Request }, plugins: [relayResponseHeaders] });
export { handleRequest as GET, handleRequest as POST, handleRequest as OPTIONS };
```
Verify `createContext` runs under Yoga (it receives the Yoga serverContext) and that the `relayResponseHeaders` plugin still appends auth/Set-Cookie headers so **login sets the session cookie** correctly.

## Verify after fix
- `POST /api/graphql {query:"{ __typename }"}` → 200.
- Demo quick-login (`[data-testid="demo-login-*"]`) signs in and redirects; `{ viewer { id username } }` returns the user.
- Subscriptions (`matchUpdated`, `competitionStandingsUpdated`, notifications) still connect over SSE/WS.
- Run the e2e suite — auth/anonymous/apply-approve specs were all failing while the endpoint was 500; they must go green again.

## Definition of done
`/api/graphql` returns 200 for queries/mutations; login + all data work; subscriptions stream; e2e suite green.
