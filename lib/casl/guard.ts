import { GraphQLError } from "graphql";
import type { AppAbility } from "./ability";
import type { AppAction } from "./subjects";

export function ensure(
  ability: AppAbility,
  action: AppAction,
  subject: Parameters<AppAbility["can"]>[1],
) {
  if (!ability.can(action, subject)) {
    throw new GraphQLError("Forbidden", {
      extensions: { code: "FORBIDDEN" },
    });
  }
}

export function requireUser<T extends { id: string }>(
  user: T | null,
): asserts user is T {
  if (!user) {
    throw new GraphQLError("Unauthorized", {
      extensions: { code: "UNAUTHORIZED" },
    });
  }
}
