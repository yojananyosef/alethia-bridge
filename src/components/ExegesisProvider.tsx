"use client";

/**
 * Provider ligero del workspace. La store de Zustand es un singleton de módulo
 * (no necesita contexto), pero este componente es el punto donde se inyectarían
 * sync groups adicionales.
 */
export function ExegesisProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
