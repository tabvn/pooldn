"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

type AppShellContext = {
  scrolled: boolean;
  collapsed: boolean;
  toggleCollapsed: () => void;
};

const Ctx = createContext<AppShellContext>({
  scrolled: false,
  collapsed: false,
  toggleCollapsed: () => {},
});

export function useAppShell() {
  return useContext(Ctx);
}

/**
 * Round-44 — app-shell wrapper.
 *
 * Locks the shell at 100dvh so the sidebar + header never scroll; the inner
 * `<main id="app-scroll">` is the only scroll container. Provides:
 *   - `scrolled` flag — driven off the main scroll event (rAF-throttled,
 *     reduced-motion friendly). The header subscribes to condense itself.
 *   - `collapsed` flag — sidebar collapsed/icon-rail mode. Persisted to a
 *     cookie (read by the server layout to set the initial className, so
 *     there's no width-flash on hydration) AND localStorage as a backup.
 */
export function AppShell({
  initialCollapsed,
  children,
}: {
  initialCollapsed: boolean;
  children: ReactNode;
}) {
  const mainRef = useRef<HTMLElement | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [collapsed, setCollapsed] = useState(initialCollapsed);

  // Scroll → setScrolled. rAF-throttled and hysteresis-guarded (different
  // thresholds for scroll-down vs scroll-up) so the header doesn't flip the
  // class on every pixel around the boundary, which made the header look
  // janky on inertial scrolls.
  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    let raf = 0;
    let queued = false;
    let lastState = false;
    const onScroll = () => {
      if (queued) return;
      queued = true;
      raf = requestAnimationFrame(() => {
        queued = false;
        const y = el.scrollTop;
        // Asymmetric thresholds: become scrolled past 24px, revert below 8px.
        const next = lastState ? y > 8 : y > 24;
        if (next !== lastState) {
          lastState = next;
          setScrolled(next);
        }
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  function toggleCollapsed() {
    setCollapsed((c) => {
      const next = !c;
      // 365 days; client-readable so the next SSR sees the same state.
      document.cookie = `pooldn_sidebar=${next ? "1" : "0"}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
      try {
        localStorage.setItem("pooldn:sidebar-collapsed", next ? "1" : "0");
      } catch {
        // private mode / disabled storage — cookie still works
      }
      return next;
    });
  }

  return (
    <Ctx.Provider value={{ scrolled, collapsed, toggleCollapsed }}>
      <div className="flex h-[100dvh] w-full overflow-hidden">
        {/*
          The children render order is fixed by the layout: <Sidebar>,
          <RightColumn> (Header + main). AppShell only owns the outermost
          flexbox + the scroll wiring.
        */}
        <ScrollMainSlot mainRef={mainRef}>{children}</ScrollMainSlot>
      </div>
    </Ctx.Provider>
  );
}

/**
 * Children consist of [Sidebar, RightColumn]. We need to thread a ref into
 * the inner <main>, but that <main> is rendered by the layout, not by us.
 * Solution: expose the ref via a slot component the layout renders.
 */
function ScrollMainSlot({
  mainRef,
  children,
}: {
  mainRef: React.MutableRefObject<HTMLElement | null>;
  children: ReactNode;
}) {
  return (
    <MainRefContext.Provider value={mainRef}>
      {children}
    </MainRefContext.Provider>
  );
}

const MainRefContext = createContext<
  React.MutableRefObject<HTMLElement | null> | null
>(null);

/**
 * Wraps the inner scrolling region. Place inside <RightColumn> after the
 * header — only one of these should render per AppShell.
 */
export function AppScrollMain({ children }: { children: ReactNode }) {
  const ref = useContext(MainRefContext);
  return (
    <main
      id="app-scroll"
      ref={ref ?? undefined}
      className="flex-1 overflow-y-auto pb-16 md:pb-0"
    >
      {children}
    </main>
  );
}
