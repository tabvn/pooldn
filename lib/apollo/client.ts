import { cookies, headers } from "next/headers";
import { HttpLink, ApolloLink } from "@apollo/client";
import { setContext } from "@apollo/client/link/context";
import {
  ApolloClient,
  InMemoryCache,
  registerApolloClient,
} from "@apollo/client-integration-nextjs";

// SSR loopback: always hit 127.0.0.1 so we don't bounce back through a
// Cloudflare tunnel. Port preference:
//   1. host header port when the request came in on localhost:NNNN directly
//   2. process.env.PORT (set when starting via `PORT=NNNN next start`)
//   3. 3000 (Next.js default)
async function resolveLoopbackUrl(): Promise<string> {
  const host = (await headers()).get("host");
  let port: string | undefined;
  if (host && /^(localhost|127\.0\.0\.1)(:|$)/.test(host)) {
    const m = host.match(/:(\d+)$/);
    if (m) port = m[1];
  }
  port = port ?? process.env.PORT ?? "3000";
  return `http://127.0.0.1:${port}/api/graphql`;
}

const perRequestContext = setContext(async (_, prev) => {
  const [cookieHeader, uri] = await Promise.all([
    cookies().then((c) => c.toString()),
    resolveLoopbackUrl(),
  ]);
  return {
    ...prev,
    uri,
    headers: {
      ...(prev?.headers ?? {}),
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
    },
  };
});

export const { getClient, query, PreloadQuery } = registerApolloClient(() => {
  return new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.from([
      perRequestContext,
      new HttpLink({ fetchOptions: { cache: "no-store" } }),
    ]),
  });
});
