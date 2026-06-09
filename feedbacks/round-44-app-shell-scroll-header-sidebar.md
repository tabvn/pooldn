# PoolDN — Fixed app-shell: inner scroll + scroll-aware header + collapsible sidebar (Round 44)

Goal: the **sidebar and header stay fixed**; only the content area scrolls. Add a polished **condense-on-scroll header** and a **collapsible icon-rail sidebar**. Files: `app/(shell)/layout.tsx`, `components/layout/header.tsx`, `components/layout/sidebar.tsx`.

**Decisions (locked):**
- Header on scroll = **CONDENSE** (72px→~56px, keep Search/Notifications/Avatar). Do NOT auto-hide.
- Sidebar default on desktop = **EXPANDED** (icons + labels); user can collapse to the icon rail, and that choice persists.

## Current state
`app/(shell)/layout.tsx` root is `flex min-h-screen w-full` with `<main className="flex-1 overflow-auto">`. Because the root is content-height (`min-h-screen`), the **browser window** scrolls and `overflow-auto` on `<main>` never engages — so the header (`h-[72px]`) and sidebar scroll away. We want the opposite.

## 1. Make the content the only scroll container (P1)
- Root shell: `flex h-[100dvh] overflow-hidden` (use `100dvh`, not `100vh`, to avoid mobile browser-chrome jump).
- Sidebar: `h-[100dvh] shrink-0` with its own `overflow-y-auto` (long nav scrolls internally, independent of content).
- Right column: `flex flex-1 flex-col min-w-0 h-[100dvh]`.
- Header: keep `shrink-0` (never scrolls).
- `<main>`: `flex-1 overflow-y-auto` — the single scroller. Give it `id="app-scroll"` + a ref so the header can observe its scroll. Keep `pb-16 md:pb-0` for the mobile bottom nav.
- **Gotchas to handle:** a single inner scroller changes `window.scrollTo`, hash-anchor (`#id`) jumps, `element.scrollIntoView`, and Next.js scroll-restoration — route them to `#app-scroll` (custom scroll-restoration handler or scroll the container on route change). Verify any `position: sticky` children (table headers, sub-tab bars, the standings sticky header) stick relative to `#app-scroll` with correct top offsets. Ensure `overflow-hidden` doesn't clip focus rings or dropdown/popover overlays (Radix portals to body, so fine).

## 2. Scroll-aware header — condense on scroll (P1, recommended) 
- Default behavior: **condense**, don't hide. At `scrollTop > 8`, transition header `h-[72px] → h-[56px]`, reduce padding, shrink/hide the logo wordmark and the city label, keep Search + Notifications + Avatar. Restore at top.
- Implementation: a small `useScrolled(threshold)` / `useScrollDirection()` hook subscribing to the `#app-scroll` element's `scroll` event (pass the scroller via React context or a ref from the layout). Toggle a **boolean** state (or a `data-scrolled` attribute) — never set style per-pixel. Animate with `transition-[height,padding] duration-200 ease-out`.
- Optional `autoHide` flag (off by default): hide on scroll-down (`translateY(-100%)`), reveal on scroll-up, with a ~12px threshold + direction debounce, rAF-throttled. Enable only on long reading pages, not globally.
- Performance + a11y: rAF-throttle the scroll handler, `passive: true` listener; honor `prefers-reduced-motion` (skip the transform/height transition, switch instantly). Keep the header an actual `shrink-0` flex child so condensing changes height without ever detaching from the top.

## 3. Collapsible sidebar → icon rail (P1)
- Toggle (chevron button) in the sidebar header: width `~240px ↔ ~64px`, `transition-[width] duration-200`.
- Collapsed rail: show **icons only**, centered and larger (`size-5`/`size-6`), hide text labels, preserve the active-route highlight. Show each label as a **tooltip on hover/focus** (Radix Tooltip or `title`) — essential for discoverability.
- Persist in `localStorage` (`pooldn:sidebar-collapsed`). Avoid the expand/collapse flash on load by reading the value in an inline `<script>` that sets a `data-sidebar` attr on `<html>` before hydration (or a cookie read in the server layout).
- A11y: the toggle is a `<button aria-expanded={!collapsed} aria-label="Collapse sidebar">`; keyboard-focusable; focus-visible rings; tooltips reachable by keyboard.
- Optional: auto-collapse below `lg`. Mobile already uses the bottom `MobileNav`, so the rail is a desktop affordance; don't show it on mobile.

## Tests
- Long page: header + sidebar stay fixed; content scrolls inside `#app-scroll`; header condenses past the threshold and restores at top; mobile bottom nav unaffected.
- Sidebar toggles to the icon rail, persists across reload (no flash), tooltips appear, active state preserved.
- Hash links / "scroll to top" / sticky table headers all work against the inner scroller.
- `prefers-reduced-motion` users get no header/width animation.
- e2e: add a `navigation.spec` case asserting the header element remains in-viewport after scrolling a tall page.

## Definition of done
The shell has a fixed sidebar + header with a single inner scroll area; the header condenses smoothly on scroll (reduced-motion respected); the sidebar collapses to a persisted icon rail with tooltips; sticky/anchor/scroll-restoration behaviors are correct on desktop and mobile; tests green.
