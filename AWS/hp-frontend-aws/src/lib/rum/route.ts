"use client";

/**
 * App Router page_view helper: send ui.page_view when pathname changes (path only, no query/hash).
 */
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { rumEvent } from "./client";
import { incrementPageview } from "./metrics";

function pathOnly(pathname: string | null): string {
  if (!pathname) return "/";
  try {
    return pathname || "/";
  } catch {
    return "/";
  }
}

export function RumRouteTracker() {
  const pathname = usePathname();
  const prev = useRef<string | null>(null);

  useEffect(() => {
    const path = pathOnly(pathname ?? null);
    if (prev.current === path) return;
    prev.current = path;
    rumEvent("ui.page_view", {
      "page.path": path,
      "page.route": path,
    });
    incrementPageview(path);
  }, [pathname]);

  return null;
}
