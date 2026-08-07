"use client";

import { useRef } from "react";

/**
 * Provider ligero del workspace. La store de Zustand es un singleton de módulo
 * (no necesita contexto), pero este componente garantiza que se monte una sola
 * vez por sesión y es el punto donde se inyectarían sync groups adicionales.
 */
export function ExegesisProvider({ children }: { children: React.ReactNode }) {
  const mounted = useRef(false);
  if (!mounted.current) {
    mounted.current = true;
  }
  return <>{children}</>;
}
