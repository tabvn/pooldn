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
    for (const [key, value] of serverContext.responseHeaders.entries()) {
      response.headers.append(key, value);
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
