"use client";

import { useEffect, useState } from "react";
import { useExegesisStore } from "../store/useExegesisStore";

/**
 * Aplica el tema activo de Zustand a <html data-theme=...>.
 * Se monta solo en cliente para evitar discrepancias de hidratación.
 */
export function ThemeApplier() {
  const theme = useExegesisStore((s) => s.activeTheme);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    void Promise.resolve().then(() => setMounted(true));
  }, []);

  useEffect(() => {
    if (mounted) document.documentElement.dataset.theme = theme;
  }, [theme, mounted]);

  return null;
}
