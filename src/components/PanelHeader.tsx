import type { ReactNode } from "react";

/** Cabecera de panel: etiqueta compacta en versalitas + acción opcional a la derecha. */
export function PanelHeader({
  children,
  right,
}: {
  children: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="flex h-9 shrink-0 items-center justify-between gap-2 border-b border-border px-3">
      <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {children}
      </h2>
      {right}
    </div>
  );
}
