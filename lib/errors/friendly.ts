/**
 * Map raw Prisma / Apollo errors to short, user-facing strings.
 *
 * Use everywhere a thrown error reaches the UI:
 *
 *   } catch (e) {
 *     toast.error("Could not save", friendlyError(e));
 *   }
 *
 * Never leak a raw Prisma stack ("Invalid `prisma.x.create()` invocation…")
 * or a GraphQL ServerError code into a toast.
 */

// Apollo's runtime error shape — duck-typed to avoid the named import which
// moved between Apollo Client major versions.
type ApolloLike = {
  graphQLErrors?: ReadonlyArray<{
    message: string;
    extensions?: Record<string, unknown>;
  }>;
  networkError?: unknown;
  message: string;
};
function isApolloLike(e: unknown): e is ApolloLike {
  return (
    !!e &&
    typeof e === "object" &&
    "graphQLErrors" in e &&
    Array.isArray((e as { graphQLErrors?: unknown }).graphQLErrors)
  );
}

const CODE_MESSAGES: Record<string, string> = {
  // Auth
  UNAUTHENTICATED: "Please sign in to continue.",
  UNAUTHORIZED: "Please sign in to continue.",
  FORBIDDEN: "You don't have permission to do that.",
  INVALID_CREDENTIALS: "Your password didn't match.",

  // Validation / conflict
  BAD_USER_INPUT: "Some of the values are invalid — check the form and try again.",
  INVALID_TRANSITION: "That action isn't allowed in the current state.",
  NOT_FOUND: "We couldn't find that.",
  EMAIL_TAKEN: "That email is already in use.",
  ALREADY_APPLIED: "Your team has already applied to this competition.",
  ALREADY_MEMBER: "That player is already on this team.",
  ALREADY_INVITED: "A pending invite already exists.",
  ALREADY_GENERATED: "Matchdays have already been generated.",
  ROSTER_CONFLICT: "A player on this roster is already entered with another team.",

  // Network / server
  INTERNAL_SERVER_ERROR: "Something went wrong on our end. Try again.",
  NETWORK_ERROR: "Network hiccup — check your connection and try again.",
};

/**
 * Best-effort: pluck a friendly message out of whatever was thrown.
 * Falls back to the message string if we don't recognise the code, and
 * to a generic "Something went wrong." for truly unknown errors.
 */
export function friendlyError(err: unknown): string {
  if (isApolloLike(err)) {
    const gql = err.graphQLErrors ?? [];
    if (gql.length > 0) {
      const g = gql[0]!;
      const code = g.extensions?.code as string | undefined;
      if (code && CODE_MESSAGES[code]) return CODE_MESSAGES[code];
      if (g.message && !looksLikePrisma(g.message)) return g.message;
    }
    if (err.networkError) return CODE_MESSAGES.NETWORK_ERROR;
    if (!looksLikePrisma(err.message)) return err.message;
    return CODE_MESSAGES.INTERNAL_SERVER_ERROR;
  }
  if (err instanceof Error) {
    const m = err.message;
    if (!looksLikePrisma(m)) return m;
    return CODE_MESSAGES.INTERNAL_SERVER_ERROR;
  }
  if (typeof err === "string" && err) return err;
  return "Something went wrong. Please try again.";
}

function looksLikePrisma(msg: string | undefined | null) {
  if (!msg) return false;
  return (
    msg.includes("Invalid `prisma") ||
    msg.includes("PrismaClient") ||
    msg.includes("Unique constraint failed") ||
    msg.includes("Foreign key constraint") ||
    msg.includes("Unknown argument") ||
    msg.includes("Argument `") ||
    msg.includes("ApolloError") ||
    /^[A-Z_]+: /.test(msg) // e.g. "INTERNAL_SERVER_ERROR: …"
  );
}
