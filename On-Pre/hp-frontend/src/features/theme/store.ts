import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemeMode = "light" | "dark" | "system";

type ThemeStore = {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  /** Resolved theme for applying to DOM (light | dark). */
  resolved: "light" | "dark";
  setResolved: (resolved: "light" | "dark") => void;
};

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      mode: "dark",
      resolved: "dark",
      setMode: (mode) => set({ mode }),
      setResolved: (resolved) => set({ resolved }),
    }),
    { name: "homeplate-theme" },
  ),
);
