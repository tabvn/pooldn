import { cookies } from "next/headers";
import { HttpLink, ApolloLink } from "@apollo/client";
import { setContext } from "@apollo/client/link/context";
import {
  ApolloClient,
  InMemoryCache,
  registerApolloClient,
} from "@apollo/client-integration-nextjs";

const GRAPHQL_URL =
  process.env.NEXT_PUBLIC_GRAPHQL_URL ?? "http://localhost:3000/api/graphql";

// Forward the request's cookie header so authenticated RSC reads (e.g. the
// shell layout's viewer query) see the signed-in user.
const forwardCookies = setContext(async (_, prev) => {
  const cookieHeader = (await cookies()).toString();
  return {
    ...prev,
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
      forwardCookies,
      new HttpLink({
        uri: GRAPHQL_URL,
        fetchOptions: { cache: "no-store" },
      }),
    ]),
  });
});
