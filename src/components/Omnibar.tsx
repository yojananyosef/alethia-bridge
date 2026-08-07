"use client";

import { useEffect, useMemo, useState } from "react";
import { Command } from "cmdk";
import { Search } from "lucide-react";
import { useExegesisStore } from "../store/useExegesisStore";
import type { ThemeId } from "../types/bible";
import type { ModuleInfo } from "../types/module";

const THEMES: { id: ThemeId; label: string }[] = [
  { id: "academic-paper", label: "Papel académico" },
  { id: "dark-contrast", label: "Contraste oscuro" },
  { id: "sepia", label: "Sepia" },
];

export function Omnibar() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [modules, setModules] = useState<ModuleInfo[]>([]);
  const { setSyncGroupA, setActiveTheme, activeModules, toggleModule } =
    useExegesisStore();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  // Lista de módulos desde el registry (antes: hardcodeada)
  useEffect(() => {
    let cancelled = false;
    void fetch("/api/modules", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { modules?: ModuleInfo[] }) => {
        if (!cancelled) setModules(d.modules ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open]);

  const commands = useMemo(() => {
    const bibles = modules.filter((m) => m.type === "bible");
    const primaryBooks =
      bibles
        .filter((m) => m.status === "installed" && (m.books?.length ?? 0) > 0)
        .sort((a, b) => (b.books?.length ?? 0) - (a.books?.length ?? 0))[0]?.books ?? [];
    const nav = primaryBooks.flatMap((b) =>
      [1, Math.max(1, Math.floor(b.capitulos / 2)), b.capitulos].map((chapter) => ({
        id: `nav-${b.id}-${chapter}`,
        label: `Ir a ${b.nombre} ${chapter}`,
        keywords: [b.id.toLowerCase(), b.nombre.toLowerCase(), String(chapter)],
        group: "navigation" as const,
        onSelect: () => setSyncGroupA({ book: b.id, chapter, verse: 1 }),
      })),
    );
    const mods = bibles.map((m) => ({
      id: `mod-${m.id}`,
      label: `${activeModules.includes(m.id) ? "Ocultar" : "Mostrar"} módulo ${m.id}`,
      keywords: [m.id.toLowerCase(), "módulo", "modules"],
      group: "modules" as const,
      onSelect: () => toggleModule(m.id),
    }));
    const themes = THEMES.map((t) => ({
      id: `theme-${t.id}`,
      label: `Tema: ${t.label}`,
      keywords: [t.label.toLowerCase(), "tema", "theme"],
      group: "theme" as const,
      onSelect: () => setActiveTheme(t.id),
    }));
    return [...nav, ...mods, ...themes];
  }, [modules, activeModules, setSyncGroupA, toggleModule, setActiveTheme]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary"
      >
        <Search className="h-3 w-3" />
        <span>Buscar o navegar…</span>
        <kbd className="ml-4 rounded border border-border px-1 text-[10px]">⌘K</kbd>
      </button>
      <Command.Dialog
        open={open}
        onOpenChange={setOpen}
        label="Omnibar"
        className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-16"
      >
        <Command className="w-full max-w-md overflow-hidden rounded-lg border border-border bg-card shadow-xl">
          <Command.Input
            value={query}
            onValueChange={setQuery}
            placeholder="Busca un pasaje, módulo o tema…"
            className="w-full border-b border-border bg-transparent px-3 py-2 text-sm outline-none"
          />
          <Command.List className="max-h-72 overflow-y-auto p-1">
            <Command.Empty className="px-3 py-4 text-center text-xs text-muted-foreground">
              Sin resultados
            </Command.Empty>
            {(["navigation", "modules", "theme"] as const).map((group) => (
              <Command.Group
                key={group}
                heading={group}
                className="px-1 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
              >
                {commands
                  .filter((c) => c.group === group)
                  .map((c) => (
                    <Command.Item
                      key={c.id}
                      value={`${c.label} ${c.keywords.join(" ")}`}
                      onSelect={() => {
                        c.onSelect();
                        setOpen(false);
                      }}
                      className="cursor-pointer rounded px-2 py-1.5 text-sm data-[selected=true]:bg-accent"
                    >
                      {c.label}
                    </Command.Item>
                  ))}
              </Command.Group>
            ))}
          </Command.List>
        </Command>
      </Command.Dialog>
    </>
  );
}
