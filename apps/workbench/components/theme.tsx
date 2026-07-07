// SPDX-License-Identifier: Apache-2.0

"use client";

import * as React from "react";

type Theme = "light" | "dark";
const ThemeCtx = React.createContext<{ theme: Theme; toggle: () => void }>({
  theme: "light",
  toggle: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = React.useState<Theme>("light");

  React.useLayoutEffect(() => {
    const stored = localStorage.getItem("orqenix-theme") as Theme | null;
    const system: Theme = window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
    const initial = stored ?? system;
    setTheme(initial);
    document.documentElement.classList.toggle("dark", initial === "dark");
  }, []);

  const toggle = React.useCallback(() => {
    setTheme((prev) => {
      const next = prev === "light" ? "dark" : "light";
      localStorage.setItem("orqenix-theme", next);
      document.documentElement.classList.toggle("dark", next === "dark");
      return next;
    });
  }, []);

  return <ThemeCtx.Provider value={{ theme, toggle }}>{children}</ThemeCtx.Provider>;
}

export function useTheme() {
  return React.useContext(ThemeCtx);
}

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      aria-label="Toggle theme"
      className="grid h-8 w-8 place-items-center rounded-md border border-[var(--line)] text-[var(--dim)] transition-colors hover:text-[var(--ink)]"
    >
      {theme === "light" ? "\u263e" : "\u2600"}
    </button>
  );
}
