type Kind = "COMPETITION" | "TEAM" | "PLAYER" | "VENUE" | "POST";

const HREF: Record<Kind, (slug: string) => string> = {
  COMPETITION: (s) => `/competitions/${s}`,
  TEAM: (s) => `/teams/${s}`,
  PLAYER: (s) => `/players/${s}`,
  VENUE: (s) => `/venues/${s}`,
  // Posts deep-link by id to the permalink page.
  POST: (s) => `/community/${s}`,
};

export function searchResultHref(kind: string, slug: string | null): string {
  const k = HREF[kind as Kind];
  if (!k) return "/";
  return k(slug ?? "");
}

export function searchKindLabel(kind: string): string {
  switch (kind) {
    case "COMPETITION":
      return "Competition";
    case "TEAM":
      return "Team";
    case "PLAYER":
      return "Player";
    case "VENUE":
      return "Venue";
    case "POST":
      return "Post";
    default:
      return kind;
  }
}

export function searchKindBadge(
  kind: string,
): "primary" | "neutral" | "warning" | "success" | "info" {
  switch (kind) {
    case "COMPETITION":
      return "primary";
    case "TEAM":
      return "warning";
    case "PLAYER":
      return "success";
    case "VENUE":
      return "neutral";
    case "POST":
      return "info";
    default:
      return "neutral";
  }
}
