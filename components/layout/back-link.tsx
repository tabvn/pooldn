"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

// Pathname of the page this DOCUMENT was loaded on. Module scope survives
// client-side navigation, so if the current pathname differs we know the user
// soft-navigated here from somewhere else in the app and history has a real
// entry to pop. Checked instead of history.state.idx (this Next version
// doesn't stamp one), history.length (counts entries from before the app was
// even opened) or document.referrer (a <Link> click is a soft navigation and
// never updates it).
const ENTRY_PATHNAME =
  typeof window === "undefined" ? null : window.location.pathname;

/**
 * Round-80 — "Back" affordance for detail screens.
 *
 * Prefers real history (`router.back()`) so it returns you to whichever list
 * you came from — the competition's matchdays, a team's fixtures, the
 * dashboard. Falls back to `href` when there's no in-app history to pop:
 * opening the page from a notification email or a pasted link would otherwise
 * leave "Back" doing nothing, or bouncing the user off the site.
 */
export function BackLink({
  href,
  label = "Back",
}: {
  /** Where to go when there's no in-app history to return to. */
  href: string;
  label?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const navigatedWithinApp = ENTRY_PATHNAME !== null && pathname !== ENTRY_PATHNAME;

  function onClick(e: React.MouseEvent<HTMLAnchorElement>) {
    // Let modified clicks (new tab/window) behave normally on the href.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
      return;
    }
    if (navigatedWithinApp) {
      e.preventDefault();
      router.back();
      return;
    }
    // Cold arrival (typed URL, email link, new tab): nothing useful behind us,
    // so let the Link navigate to `href`.
  }

  return (
    <Link
      href={href}
      onClick={onClick}
      className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      data-testid="detail-back"
    >
      <ArrowLeft className="size-3.5" />
      {label}
    </Link>
  );
}
