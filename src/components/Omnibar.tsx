"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { Command } from "cmdk";
import {
  BookOpen,
  Check,
  Compass,
  FileText,
  Globe2,
  Loader2,
  Moon,
  Search,
  Sparkles,
  Sun,
  Zap,
} from "lucide-react";
import { LibraryManagerModal } from "./catalog/LibraryManagerModal";
import { useExegesisStore } from "../store/useExegesisStore";
import type { SearchResponse, SearchResult, ThemeId } from "../types/bible";
import type { ModuleInfo } from "../types/module";
import { CANON } from "../lib/canon";

const THEMES: { id: ThemeId; label: string; icon: typeof Sun }[] = [
  { id: "academic-paper", label: "Papel Académico (Claro)", icon: Sun },
  { id: "dark-contrast", label: "Contraste Oscuro (Noche)", icon: Moon },
  { id: "sepia", label: "Sepia (Pergamino Cálido)", icon: Sparkles },
];

export function Omnibar() {
  const [open, setOpen] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [modules, setModules] = useState<ModuleInfo[]>([]);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchTotal, setSearchTotal] = useState(0);
  const [searchDuration, setSearchDuration] = useState<number | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const {
    setSyncGroupA,
    setActiveTheme,
    activeTheme,
    activeModules,
    toggleModule,
    setActiveLexiconTerm,
  } = useExegesisStore();

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

  // Cargar módulos registrados
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch("/api/modules", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { modules?: ModuleInfo[] }) => {
        if (!cancelled) setModules(d.modules ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Búsqueda en vivo con FTS5 cuando el usuario escribe
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    const clean = query.trim();
    if (clean.length < 2) {
      queueMicrotask(() => {
        setSearchResults([]);
        setSearchTotal(0);
        setSearchDuration(null);
        setIsSearching(false);
      });
      return;
    }

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    queueMicrotask(() => {
      setIsSearching(true);
    });

    searchTimeoutRef.current = setTimeout(() => {
      const activeStr = activeModules.length > 0 ? activeModules.join(",") : "RV1909";
      fetch(`/api/bible/search?q=${encodeURIComponent(clean)}&modules=${encodeURIComponent(activeStr)}&limit=15`, {
        cache: "no-store",
      })
        .then((r) => r.json())
        .then((data: SearchResponse) => {
          setSearchResults(data.results ?? []);
          setSearchTotal(data.total ?? 0);
          setSearchDuration(data.durationMs ?? null);
          setIsSearching(false);
        })
        .catch(() => {
          setIsSearching(false);
        });
    }, 120);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [query, activeModules]);

  // Coincidencias de navegación canónica directa
  const canonMatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return CANON.slice(0, 10).map((b) => ({
        id: b.id,
        nombre: b.nombre,
        chapter: 1,
        label: `${b.nombre} 1`,
      }));
    }

    const matches: { id: string; nombre: string; chapter: number; label: string }[] = [];
    for (const b of CANON) {
      const bLower = b.nombre.toLowerCase();
      const idLower = b.id.toLowerCase();
      const codeLower = b.code.toLowerCase();

      if (bLower.includes(q) || idLower.includes(q) || codeLower.includes(q)) {
        matches.push({
          id: b.id,
          nombre: b.nombre,
          chapter: 1,
          label: `${b.nombre} (Capítulos 1-${b.capitulos})`,
        });
      }
    }
    return matches.slice(0, 8);
  }, [query]);

  // Si la query coincide con un código Strong (G3056, H7225, etc.)
  const isStrongQuery = useMemo(() => {
    return /^[gh]\d+$/i.test(query.trim());
  }, [query]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2.5 rounded-lg border border-border bg-card/80 px-3 py-1.5 text-xs text-muted-foreground shadow-xs backdrop-blur-xs transition-all hover:border-primary/60 hover:text-foreground hover:shadow-sm"
        title="Buscar versículos, léxico o comandos (Ctrl+K / ⌘K)"
      >
        <Search className="size-3.5 text-primary" />
        <span className="hidden sm:inline font-medium">Buscar pasajes, léxico o Strong…</span>
        <span className="sm:hidden font-medium">Buscar…</span>
        <kbd className="ml-2 flex items-center gap-0.5 rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted-foreground">
          <span className="text-[9px]">⌘</span>K
        </kbd>
      </button>

      <Command.Dialog
        open={open}
        onOpenChange={setOpen}
        label="Omnibar"
        className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 sm:p-12 md:p-20 backdrop-blur-xs animate-in fade-in-0 duration-150"
      >
        <Command
          className="flex w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-2xl animate-in zoom-in-98 duration-150"
          loop
        >
          {/* Input de búsqueda */}
          <div className="flex items-center border-b border-border px-3.5 py-2.5">
            <Search className="mr-2.5 size-4 text-primary shrink-0" />
            <Command.Input
              value={query}
              onValueChange={setQuery}
              placeholder="Escribe un pasaje (Jn 1), Strong (G3056) o palabra (luz, gracia)…"
              className="flex-1 bg-transparent text-sm font-medium outline-none placeholder:text-muted-foreground/70"
              autoFocus
            />
            {isSearching ? (
              <Loader2 className="size-4 animate-spin text-primary shrink-0" />
            ) : query.length > 0 ? (
              <button
                onClick={() => setQuery("")}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Limpiar
              </button>
            ) : (
              <span className="text-[11px] font-mono text-muted-foreground">ESC para cerrar</span>
            )}
          </div>

          {/* Barra de métricas si hay búsqueda activa */}
          {searchDuration !== null && searchResults.length > 0 && (
            <div className="flex items-center justify-between border-b border-border/60 bg-muted/40 px-4 py-1.5 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Zap className="size-3 text-amber-500" />
                <span className="font-semibold text-foreground">{searchTotal}</span> coincidencias encontradas en FTS5
              </span>
              <span className="font-mono text-[10px] bg-background border border-border px-1.5 py-0.5 rounded">
                {searchDuration.toFixed(1)} ms
              </span>
            </div>
          )}

          {/* Lista de resultados cmdk */}
          <Command.List className="max-h-[60vh] overflow-y-auto p-2 scrollbar-thin">
            <Command.Empty className="px-6 py-8 text-center text-xs text-muted-foreground">
              {isSearching ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="size-5 animate-spin text-primary" />
                  <span>Buscando en la base de datos…</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1.5">
                  <FileText className="size-6 text-muted-foreground/40" />
                  <p className="font-medium text-foreground">Sin resultados para &ldquo;{query}&rdquo;</p>
                  <p className="text-[11px] text-muted-foreground">
                    Prueba buscando una palabra en español o griego, un libro (&ldquo;Génesis&rdquo;), o un Strong (&ldquo;G3056&rdquo;).
                  </p>
                </div>
              )}
            </Command.Empty>

            {/* Acceso directo si es código Strong */}
            {isStrongQuery && (
              <Command.Group heading="Léxico & Diccionario Strong" className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-primary">
                <Command.Item
                  value={`strong-${query}`}
                  onSelect={() => {
                    setActiveLexiconTerm(query.toUpperCase());
                    setOpen(false);
                  }}
                  className="flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground"
                >
                  <div className="flex items-center gap-2">
                    <Sparkles className="size-4 text-amber-500" />
                    <span>
                      Ver entrada léxica completa para <strong className="text-primary">{query.toUpperCase()}</strong>
                    </span>
                  </div>
                  <kbd className="rounded border border-border bg-card px-1.5 py-0.5 text-[10px] font-mono">Abrir Panel</kbd>
                </Command.Item>
              </Command.Group>
            )}

            {/* Resultados de búsqueda en versículos (FTS5) */}
            {searchResults.length > 0 && (
              <Command.Group heading={`Versículos con "${query}" (${searchResults.length} mostrados)`} className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-primary">
                {searchResults.map((r, idx) => (
                  <Command.Item
                    key={`${r.moduleId}-${r.reference}-${idx}`}
                    value={`search-${r.reference}-${r.snippet}`}
                    onSelect={() => {
                      setSyncGroupA({ book: r.book, chapter: r.chapter, verse: r.verse });
                      setOpen(false);
                    }}
                    className="flex cursor-pointer flex-col gap-1 rounded-lg px-3 py-2 text-xs transition-colors data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-primary flex items-center gap-1.5">
                        <BookOpen className="size-3.5" />
                        {r.reference}
                      </span>
                      <span className="rounded bg-muted border border-border px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground">
                        {r.moduleId}
                      </span>
                    </div>
                    <div
                      className="text-muted-foreground leading-relaxed [&>mark]:bg-amber-400/30 [&>mark]:text-foreground [&>mark]:font-semibold [&>mark]:rounded-xs [&>mark]:px-0.5"
                      dangerouslySetInnerHTML={{ __html: r.snippet }}
                    />
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Navegación rápida por libros y pasajes */}
            {canonMatches.length > 0 && (
              <Command.Group heading="Navegación de Libros Bíblicos" className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {canonMatches.map((b) => (
                  <Command.Item
                    key={`nav-${b.id}`}
                    value={`nav-${b.id}-${b.nombre}`}
                    onSelect={() => {
                      setSyncGroupA({ book: b.id, chapter: 1, verse: 1 });
                      setOpen(false);
                    }}
                    className="flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground"
                  >
                    <div className="flex items-center gap-2.5">
                      <Compass className="size-4 text-muted-foreground" />
                      <span className="font-medium">{b.nombre}</span>
                    </div>
                    <span className="text-xs text-muted-foreground font-mono">{b.id}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Gestión de Módulos Bíblicos */}
            <Command.Group heading="Módulos & Versiones" className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {modules
                .filter((m) => m.type === "bible")
                .map((m) => {
                  const isActive = activeModules.includes(m.id);
                  return (
                    <Command.Item
                      key={`mod-${m.id}`}
                      value={`mod-${m.id}-${m.name}`}
                      onSelect={() => {
                        toggleModule(m.id);
                      }}
                      className="flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground"
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`size-2 rounded-full ${
                            isActive ? "bg-primary" : "bg-muted-foreground/30"
                          }`}
                        />
                        <span>{m.name}</span>
                        <span className="text-xs text-muted-foreground">({m.id})</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {isActive ? "Activo (clic para ocultar)" : "Inactivo (clic para mostrar)"}
                      </span>
                    </Command.Item>
                  );
                })}
            </Command.Group>

            {/* Acceso a la Biblioteca y Catálogo Remoto */}
            <Command.Group heading="Biblioteca & Marketplace de Recursos" className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-primary">
              <Command.Item
                value="catalog-store-marketplace-tienda"
                onSelect={() => {
                  setOpen(false);
                  setCatalogOpen(true);
                }}
                className="flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground"
              >
                <div className="flex items-center gap-2.5">
                  <Globe2 className="size-4 text-primary" />
                  <div>
                    <span className="font-semibold text-foreground">Abrir Catálogo y Tienda de Módulos</span>
                    <p className="text-[11px] text-muted-foreground">Explora e instala Biblias, Textos Originales, Strongs y Comentarios</p>
                  </div>
                </div>
                <kbd className="rounded border border-border bg-card px-1.5 py-0.5 text-[10px] font-mono">Abrir Tienda</kbd>
              </Command.Item>
            </Command.Group>

            {/* Selector de Temas Visuales */}
            <Command.Group heading="Temas de Visualización" className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {THEMES.map((t) => {
                const Icon = t.icon;
                const isCurrent = activeTheme === t.id;
                return (
                  <Command.Item
                    key={`theme-${t.id}`}
                    value={`theme-${t.id}-${t.label}`}
                    onSelect={() => {
                      setActiveTheme(t.id);
                      setOpen(false);
                    }}
                    className="flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground"
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className="size-4 text-primary" />
                      <span>{t.label}</span>
                    </div>
                    {isCurrent && <Check className="size-4 text-primary" />}
                  </Command.Item>
                );
              })}
            </Command.Group>
          </Command.List>

          {/* Footer con atajos */}
          <div className="flex items-center justify-between border-t border-border bg-muted/20 px-4 py-2 text-[11px] text-muted-foreground">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-border bg-card px-1 font-mono text-[9px]">↑↓</kbd> Navegar
              </span>
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-border bg-card px-1 font-mono text-[9px]">↵</kbd> Seleccionar
              </span>
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-border bg-card px-1 font-mono text-[9px]">ESC</kbd> Salir
              </span>
            </div>
            <span className="font-semibold text-primary">AlethiaBridge Engine</span>
          </div>
        </Command>
      </Command.Dialog>

      <LibraryManagerModal
        open={catalogOpen}
        onOpenChange={setCatalogOpen}
      />
    </>
  );
}
