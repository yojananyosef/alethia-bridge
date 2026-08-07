"use client";

import { useEffect } from "react";
import { useExegesisStore } from "../store/useExegesisStore";

/**
 * Aplica el tema activo de Zustand a <html data-theme=...> y maneja la clase .dark.
 */
export function ThemeApplier() {
  const theme = useExegesisStore((s) => s.activeTheme);
  const setActiveTheme = useExegesisStore((s) => s.setActiveTheme);

  // Cargar tema guardado al iniciar
  useEffect(() => {
    try {
      const saved = localStorage.getItem("alethia-theme");
      if (saved === "academic-paper" || saved === "dark-contrast" || saved === "sepia") {
        setActiveTheme(saved);
      }
    } catch {}
  }, [setActiveTheme]);

  // Aplicar tema reactivo
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", theme);
    document.body.setAttribute("data-theme", theme);

    if (theme === "dark-contrast") {
      root.classList.add("dark");
      document.body.classList.add("dark");
    } else {
      root.classList.remove("dark");
      document.body.classList.remove("dark");
    }

    try {
      localStorage.setItem("alethia-theme", theme);
    } catch {}
  }, [theme]);

  return null;
}

