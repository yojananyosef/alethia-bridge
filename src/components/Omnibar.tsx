"use client";

import { useEffect, useMemo, useState } from "react";
import { Command } from "cmdk";
import { Search } from "lucide-react";
import { useExegesisStore } from "../store/useExegesisStore";
import type { ThemeId } from "../types/bible";

const THEMES: { id: ThemeId; label: string }[] = [
  { id: "academic-paper", label: "Papel académico" },
  { id: "dark-contrast", label: "Contraste oscuro" },
  { id: "sepia", label: "Sepia" },
];

export function Omnibar() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { syncGroupA, setSyncGroupA, activeTheme, setActiveTheme, activeModules, toggleModule } =
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

  const commands = useMemo(() => {
    const nav = ["Jn", "Gen", "Apo"].flatMap((book) =>
      [1, 3, 10, 16, 21].map((chapter) => ({
        id: `nav-${book}-${chapter}`,
        label: `Ir a ${book} ${chapter}`,
        keywords: [book.toLowerCase(), String(chapter)],
        group: "navigation" as const,
        onSelect: () => setSyncGroupA({ book, chapter, verse: 1 }),
      })),
    );
    const modules = ["RV1909", "NA28", "WTT"].map((m) => ({
      id: `mod-${m}`,
      label: `${activeModules.includes(m) ? "Ocultar" : "Mostrar"} módulo ${m}`,
      keywords: [m.toLowerCase(), "módulo", "modules"],
      group: "modules" as const,
      onSelect: () => toggleModule(m),
    }));
    const themes = THEMES.map((t) => ({
      id: `theme-${t.id}`,
      label: `Tema: ${t.label}`,
      keywords: [t.label.toLowerCase(), "tema", "theme"],
      group: "theme" as const,
      onSelect: () => setActiveTheme(t.id),
    }));
    return [...nav, ...modules, ...themes];
  }, [activeModules, setSyncGroupA, toggleModule, setActiveTheme]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 text-xs text-[var(--muted)] transition-colors hover:border-[var(--accent)]"
      >
        <Search className="h-3 w-3" />
        <span>Buscar o navegar…</span>
        <kbd className="ml-4 rounded border border-[var(--border)] px-1 text-[10px]">⌘K</kbd>
      </button>
      <Command.Dialog
        open={open}
        onOpenChange={setOpen}
        label="Omnibar"
        className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-16"
      >
        <Command className="w-full max-w-md overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--panel)] shadow-xl">
          <Command.Input
            value={query}
            onValueChange={setQuery}
            placeholder="Busca un pasaje, módulo o tema…"
            className="w-full border-b border-[var(--border)] bg-transparent px-3 py-2 text-sm outline-none"
          />
          <Command.List className="max-h-72 overflow-y-auto p-1">
            <Command.Empty className="px-3 py-4 text-center text-xs text-[var(--muted)]">
              Sin resultados
            </Command.Empty>
            {(["navigation", "modules", "theme"] as const).map((group) => (
              <Command.Group
                key={group}
                heading={group}
                className="px-1 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]"
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
                      className="cursor-pointer rounded px-2 py-1.5 text-sm data-[selected=true]:bg-[var(--accent-soft)]"
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
