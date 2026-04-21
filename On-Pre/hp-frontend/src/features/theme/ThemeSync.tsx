"use client";

import { useEffect } from "react";
import { useThemeStore } from "./store";

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function ThemeSync() {
  const { mode, setResolved } = useThemeStore();

  useEffect(() => {
    const resolve = () => {
      const resolved = mode === "system" ? getSystemTheme() : mode;
      setResolved(resolved);
      document.documentElement.setAttribute("data-theme", resolved);
    };

    resolve();

    if (mode === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const listener = () => resolve();
      mq.addEventListener("change", listener);
      return () => mq.removeEventListener("change", listener);
    }
  }, [mode, setResolved]);

  return null;
}
