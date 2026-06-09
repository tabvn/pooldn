import { createYoga, type Plugin } from "graphql-yoga";
import { schema } from "@/lib/graphql/schema";
import {
  createContext,
  type GraphQLContext,
  type ServerContext,
} from "@/lib/graphql/context";

const relayResponseHeaders: Plugin<GraphQLContext, ServerContext> = {
  onResponse({ serverContext, response }) {
    if (!serverContext?.responseHeaders) return;
    // Round-45 fix — `Headers.entries()` joins multiple set-cookie values
    // with `, `, which silently corrupts both cookies because cookie
    // attribute values legally contain commas (Expires=... GMT). The Fetch
    // spec provides `getSetCookie()` to retrieve each row separately; if
    // the runtime supports it we use it. If not, we fall back to the
    // joined string (Yoga's runtime joins, but a single cookie still
    // round-trips intact — only the two-cookie case is at risk).
    const headers = serverContext.responseHeaders;
    const hasGetSetCookie =
      typeof (headers as { getSetCookie?: () => string[] }).getSetCookie ===
      "function";
    if (hasGetSetCookie) {
      for (const c of (headers as Headers).getSetCookie()) {
        response.headers.append("set-cookie", c);
      }
      for (const [key, value] of headers.entries()) {
        if (key.toLowerCase() === "set-cookie") continue;
        response.headers.append(key, value);
      }
    } else {
      // Fallback: forward whatever the source has; single-cookie responses
      // (everything except login/register) round-trip correctly here.
      for (const [key, value] of headers.entries()) {
        response.headers.append(key, value);
      }
    }
  },
};

const yoga = createYoga<ServerContext, GraphQLContext>({
  schema,
  context: createContext,
  graphqlEndpoint: "/api/graphql",
  fetchAPI: { Response, Request },
  plugins: [relayResponseHeaders],
});

async function handle(request: Request) {
  return yoga.handle(request, { responseHeaders: new Headers() });
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}

export async function OPTIONS(request: Request) {
  return handle(request);
}
