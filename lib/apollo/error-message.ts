import { CombinedGraphQLErrors } from "@apollo/client/errors";

/**
 * Round-89 — read the message a human should see out of an Apollo error.
 *
 * Apollo Client 4 wraps GraphQL errors in `CombinedGraphQLErrors`, and in a
 * PRODUCTION build its `.message` is minified away to a placeholder:
 *
 *   "An error occurred! For more details, see the full error text at
 *    https://go.apollo.dev/c/err#..."
 *
 * Every `catch (e) { toast.error(..., e.message) }` in the app was therefore
 * showing that link to users instead of the server's message — "Invalid
 * credentials", "You're already in this competition", and so on. It only
 * reproduces in a production build, which is why it survived dev testing.
 *
 * The individual GraphQL errors are never minified, so read the first one and
 * fall back to the raw message for non-GraphQL failures (network, parse).
 */
const APOLLO_MINIFIED = "go.apollo.dev/c/err";

export function errorText(error: unknown, fallback: string): string;
export function errorText(error: unknown, fallback?: undefined): string | undefined;
export function errorText(
  error: unknown,
  fallback?: string,
): string | undefined {
  if (CombinedGraphQLErrors.is(error)) {
    const first = error.errors.find((e) => e.message)?.message;
    if (first) return first;
  }
  // `.is()` brand-checks the class, which doesn't always match once the error
  // has crossed a bundle boundary or been wrapped, so fall back to the shape:
  // `errors` (v4 CombinedGraphQLErrors), `graphQLErrors` (v3 ApolloError), or
  // either of those on a wrapped cause.
  const shape = error as {
    errors?: unknown;
    graphQLErrors?: unknown;
    cause?: { errors?: unknown; graphQLErrors?: unknown };
  } | null;
  for (const list of [
    shape?.errors,
    shape?.graphQLErrors,
    shape?.cause?.errors,
    shape?.cause?.graphQLErrors,
  ]) {
    if (!Array.isArray(list)) continue;
    const first = list.find(
      (e): e is { message: string } =>
        typeof (e as { message?: unknown })?.message === "string" &&
        (e as { message: string }).message.length > 0,
    );
    if (first) return first.message;
  }
  // Apollo wraps an error thrown by a link, and the wrapper's own message is
  // minified in production too — the real one sits on `cause` (possibly a few
  // levels down), so walk the chain before giving up.
  let node: unknown = error;
  for (let depth = 0; depth < 5 && node; depth += 1) {
    if (node instanceof Error && node.message && !node.message.includes(APOLLO_MINIFIED)) {
      return node.message;
    }
    const list = (node as { graphQLErrors?: unknown }).graphQLErrors;
    if (Array.isArray(list)) {
      const first = list.find(
        (e): e is { message: string } =>
          typeof (e as { message?: unknown })?.message === "string",
      );
      if (first?.message) return first.message;
    }
    node = (node as { cause?: unknown }).cause;
  }
  return fallback;
}
