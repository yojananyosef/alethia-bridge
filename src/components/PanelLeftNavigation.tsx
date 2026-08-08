import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  ChevronDown,
  Globe2,
  Layers,
  PackagePlus,
  PanelLeftOpen,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Checkbox } from "../components/ui/checkbox";
import { Skeleton } from "../components/ui/skeleton";
import {
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  useSidebar,
} from "../components/ui/sidebar";
import { LibraryManagerModal } from "./catalog/LibraryManagerModal";
import { useExegesisStore } from "../store/useExegesisStore";
import type { ModuleBook, ModuleInfo } from "../types/module";
import { CANON } from "../lib/canon";
import { cn } from "../lib/utils";

const OT_BOOK_IDS = new Set(CANON.slice(0, 39).map((b) => b.id));
const NT_BOOK_IDS = new Set(CANON.slice(39).map((b) => b.id));

async function fetchModules(installedList?: string[]): Promise<ModuleInfo[]> {
  const headers: Record<string, string> = {};
  if (installedList && installedList.length > 0) {
    headers["x-installed-modules"] = installedList.join(",");
  }
  const res = await fetch("/api/modules", { cache: "no-store", headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = (await res.json()) as { modules: ModuleInfo[] };
  return body.modules;
}

const LANG_BADGES: Record<string, { label: string; bg: string }> = {
  es: { label: "Español", bg: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30" },
  el: { label: "Griego", bg: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30" },
  he: { label: "Hebreo", bg: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" },
};

function BookItem({
  book,
  chapters,
  isExpanded,
  onToggleExpand,
}: {
  book: ModuleBook;
  chapters: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
}) {
  const { syncGroupA, setSyncGroupA } = useExegesisStore();
  const isActive = syncGroupA.book === book.id;

  return (
    <div className="mb-0.5 rounded-md transition-colors">
      <button
        onClick={() => {
          onToggleExpand();
          if (!isActive) {
            setSyncGroupA({ book: book.id, chapter: 1, verse: 1 });
          }
        }}
        className={cn(
          "flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
          isActive
            ? "bg-primary text-primary-foreground shadow-xs font-semibold"
            : "text-foreground/90 hover:bg-accent/60",
        )}
      >
        <span className="flex items-center gap-2 truncate">
          <BookOpen className={cn("size-3.5 shrink-0", isActive ? "text-primary-foreground" : "text-primary")} />
          <span className="truncate">{book.nombre}</span>
        </span>
        <div className="flex items-center gap-1">
          <span
            className={cn(
              "text-[10px] font-mono",
              isActive ? "text-primary-foreground/80" : "text-muted-foreground",
            )}
          >
            {chapters} cap.
          </span>
          <ChevronDown
            className={cn(
              "size-3 transition-transform duration-200",
              isExpanded && "rotate-180",
              isActive ? "text-primary-foreground" : "text-muted-foreground",
            )}
          />
        </div>
      </button>

      {/* Selector de capítulos */}
      {isExpanded && (
        <div className="my-1.5 grid grid-cols-7 gap-1 rounded-md border border-border/60 bg-muted/30 p-1.5 animate-in fade-in-0 duration-150">
          {Array.from({ length: chapters }, (_, i) => i + 1).map((c) => (
            <button
              key={c}
              onClick={(e) => {
                e.stopPropagation();
                setSyncGroupA({ book: book.id, chapter: c, verse: 1 });
              }}
              className={cn(
                "flex h-6 items-center justify-center rounded text-[11px] font-mono transition-all",
                isActive && syncGroupA.chapter === c
                  ? "bg-primary text-primary-foreground font-bold shadow-xs scale-105"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {c}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function PanelLeftNavigation() {
  const { state, setOpen } = useSidebar();
  const [modules, setModules] = useState<ModuleInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");
  const [testamentFilter, setTestamentFilter] = useState<"ALL" | "OT" | "NT">("ALL");
  const [biblesOpen, setBiblesOpen] = useState(true);
  const [modulesOpen, setModulesOpen] = useState(true);
  const [expandedBookId, setExpandedBookId] = useState<string | null>("Gen");
  const [catalogOpen, setCatalogOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { syncGroupA, installedModules } = useExegesisStore();

  const refresh = useCallback(async () => {
    try {
      setModules(await fetchModules(installedModules));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [installedModules]);

  useEffect(() => {
    void Promise.resolve().then(refresh);
  }, [refresh]);

  useEffect(() => {
    if (syncGroupA.book) {
      queueMicrotask(() => {
        setExpandedBookId(syncGroupA.book);
      });
    }
  }, [syncGroupA.book]);

  const primary = useMemo(
    () =>
      (modules ?? [])
        .filter((m) => m.type === "bible" && m.status === "installed" && (m.books?.length ?? 0) > 0)
        .sort((a, b) => (b.books?.length ?? 0) - (a.books?.length ?? 0))[0] ?? null,
    [modules],
  );

  const filteredBooks = useMemo(() => {
    const all = primary?.books ?? [];
    return all.filter((b) => {
      const matchesText =
        searchFilter === "" ||
        b.nombre.toLowerCase().includes(searchFilter.toLowerCase()) ||
        b.id.toLowerCase().includes(searchFilter.toLowerCase());

      if (!matchesText) return false;
      if (testamentFilter === "OT") return OT_BOOK_IDS.has(b.id);
      if (testamentFilter === "NT") return NT_BOOK_IDS.has(b.id);
      return true;
    });
  }, [primary, searchFilter, testamentFilter]);

  const install = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/modules", { method: "POST", body: form });
      const body = (await res.json()) as { ok?: boolean; moduleId?: string; error?: string };
      if (!res.ok || !body.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (m: ModuleInfo) => {
    setModules((prev) =>
      prev === null
        ? prev
        : prev.map((x) =>
            x.id === m.id ? { ...x, status: x.status === "installed" ? "disabled" : "installed" } : x,
          ),
    );
    try {
      await fetch(`/api/modules/${encodeURIComponent(m.id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled: m.status === "disabled" }),
      });
      await refresh();
    } catch {
      await refresh();
    }
  };

  const uninstall = async (m: ModuleInfo) => {
    if (!window.confirm(`¿Desinstalar el módulo "${m.name}" (${m.id})?`)) return;
    try {
      const res = await fetch(`/api/modules/${encodeURIComponent(m.id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  // MODO COLAPSADO (icono 48px): vista ultra-limpia sin textos rotos
  if (state === "collapsed") {
    return (
      <div className="flex h-full w-full flex-col items-center justify-between py-3">
        <div className="flex flex-col items-center gap-3">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setOpen(true)}
            title="Expandir barra lateral (Ctrl+B)"
            className="size-8 text-primary hover:bg-accent"
          >
            <PanelLeftOpen className="size-4" />
          </Button>

          <Button
            variant="secondary"
            size="icon-sm"
            onClick={() => setOpen(true)}
            title={`Libro actual: ${syncGroupA.book} ${syncGroupA.chapter}`}
            className="size-8 font-mono text-[11px] font-bold text-primary shadow-xs"
          >
            {syncGroupA.book.slice(0, 3)}
          </Button>

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setOpen(true)}
            title="Ver canon bíblico completo"
            className="size-8 text-muted-foreground hover:text-foreground"
          >
            <BookOpen className="size-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setOpen(true)}
            title="Módulos bíblicos instalados"
            className="size-8 text-muted-foreground hover:text-foreground"
          >
            <Layers className="size-4" />
          </Button>
        </div>

        <div className="flex flex-col items-center gap-2">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setCatalogOpen(true)}
            title="Abrir Catálogo y Tienda de Recursos"
            className="size-8 text-primary hover:bg-primary/10"
          >
            <Globe2 className="size-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => fileRef.current?.click()}
            title="Instalar módulo .abmod local"
            className="size-8 text-muted-foreground hover:text-primary"
          >
            <PackagePlus className="size-4" />
          </Button>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept=".abmod"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void install(f);
            e.target.value = "";
          }}
        />

        <LibraryManagerModal
          open={catalogOpen}
          onOpenChange={setCatalogOpen}
          onModuleChanged={refresh}
        />
      </div>
    );
  }

  // MODO EXPANDIDO: vista completa con filtros y acordeones
  return (
    <>
      <SidebarHeader className="border-b border-border bg-card/60 px-3 py-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="size-4 text-primary" />
            <span className="text-xs font-bold uppercase tracking-wider text-foreground">
              Biblioteca & Canon
            </span>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setCatalogOpen(true)}
            className="h-6 gap-1 px-2 text-[10px] font-bold text-primary border-primary/30 hover:bg-primary/10"
            title="Abrir Catálogo y Tienda de Módulos Remotos"
          >
            <Globe2 className="size-3" />
            <span>Tienda</span>
          </Button>
        </div>
      </SidebarHeader>

      <SidebarContent className="p-2 space-y-3">
        {/* Grupo de Navegación Canónica */}
        <SidebarGroup>
          <div className="flex items-center justify-between px-1 mb-1">
            <SidebarGroupLabel
              className="cursor-pointer select-none gap-1.5 font-bold uppercase tracking-wider text-[10px] text-muted-foreground hover:text-foreground"
              onClick={() => setBiblesOpen((o) => !o)}
            >
              <ChevronDown
                className={cn("size-3.5 transition-transform duration-200", !biblesOpen && "-rotate-90")}
              />
              Canon Bíblico
            </SidebarGroupLabel>
            <span className="text-[10px] font-mono text-muted-foreground">
              {filteredBooks.length} libros
            </span>
          </div>

          {biblesOpen && (
            <SidebarGroupContent className="space-y-2">
              {/* Buscador de libros rápido */}
              <div className="relative mb-2">
                <Search className="absolute left-2.5 top-2 size-3.5 text-muted-foreground" />
                <input
                  type="text"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="Filtrar libro (ej: Génesis, Salmos)…"
                  className="w-full rounded-md border border-border bg-background py-1.5 pl-8 pr-2.5 text-xs text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary transition-colors"
                />
              </div>

              {/* Pestañas de Testamentos */}
              <div className="grid grid-cols-3 gap-1 rounded-lg border border-border bg-muted/40 p-0.5 text-[10px] font-semibold">
                <button
                  onClick={() => setTestamentFilter("ALL")}
                  className={cn(
                    "rounded py-1 transition-all",
                    testamentFilter === "ALL"
                      ? "bg-card text-foreground shadow-xs font-bold"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Todos (66)
                </button>
                <button
                  onClick={() => setTestamentFilter("OT")}
                  className={cn(
                    "rounded py-1 transition-all",
                    testamentFilter === "OT"
                      ? "bg-card text-foreground shadow-xs font-bold"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  A.T. (39)
                </button>
                <button
                  onClick={() => setTestamentFilter("NT")}
                  className={cn(
                    "rounded py-1 transition-all",
                    testamentFilter === "NT"
                      ? "bg-card text-foreground shadow-xs font-bold"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  N.T. (27)
                </button>
              </div>

              {/* Lista de libros */}
              <div className="max-h-[38vh] overflow-y-auto pr-0.5 space-y-0.5 scrollbar-thin">
                {modules === null ? (
                  <div className="space-y-2 p-2">
                    <Skeleton className="h-6 w-full" />
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-6 w-5/6" />
                  </div>
                ) : filteredBooks.length > 0 ? (
                  filteredBooks.map((b) => (
                    <BookItem
                      key={b.id}
                      book={b}
                      chapters={b.capitulos}
                      isExpanded={expandedBookId === b.id}
                      onToggleExpand={() =>
                        setExpandedBookId((curr) => (curr === b.id ? null : b.id))
                      }
                    />
                  ))
                ) : (
                  <p className="px-2 py-4 text-center text-xs text-muted-foreground">
                    No se encontraron libros con &ldquo;{searchFilter}&rdquo;
                  </p>
                )}
              </div>
            </SidebarGroupContent>
          )}
        </SidebarGroup>

        {/* Grupo de Módulos Instalados */}
        <SidebarGroup>
          <div className="flex items-center justify-between px-1 mb-1">
            <SidebarGroupLabel
              className="cursor-pointer select-none gap-1.5 font-bold uppercase tracking-wider text-[10px] text-muted-foreground hover:text-foreground"
              onClick={() => setModulesOpen((o) => !o)}
            >
              <ChevronDown
                className={cn("size-3.5 transition-transform duration-200", !modulesOpen && "-rotate-90")}
              />
              Módulos (.abmod)
            </SidebarGroupLabel>
            <SidebarGroupAction
              onClick={() => fileRef.current?.click()}
              title="Instalar paquete de módulo .abmod"
              className="hover:text-primary transition-colors"
            >
              <PackagePlus className="size-3.5" />
            </SidebarGroupAction>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept=".abmod"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void install(f);
              e.target.value = "";
            }}
          />

          {modulesOpen && (
            <SidebarGroupContent className="space-y-1.5">
              {error && <p className="rounded bg-destructive/10 p-2 text-xs text-destructive">{error}</p>}
              <div className="space-y-1">
                {(modules ?? []).map((m) => {
                  const lang = LANG_BADGES[m.language] ?? {
                    label: m.language,
                    bg: "bg-muted text-muted-foreground border-border",
                  };
                  return (
                    <div
                      key={m.id}
                      className="flex items-center justify-between rounded-lg border border-border/70 bg-card p-2 text-xs shadow-2xs hover:border-primary/40 transition-colors"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Checkbox
                          checked={m.status === "installed"}
                          onCheckedChange={() => void toggle(m)}
                          aria-label={`Habilitar ${m.id}`}
                        />
                        <div className="truncate">
                          <div className="flex items-center gap-1.5 font-semibold text-foreground">
                            <span className="truncate">{m.id}</span>
                            <span
                              className={cn(
                                "rounded border px-1 py-0.2 text-[9px] font-mono font-medium",
                                lang.bg,
                              )}
                            >
                              {lang.label}
                            </span>
                          </div>
                          <p className="truncate text-[10px] text-muted-foreground">
                            {m.name} · v{m.version}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => void uninstall(m)}
                        className="size-6 text-muted-foreground hover:bg-destructive/10 hover:text-destructive shrink-0"
                        title={`Desinstalar ${m.id}`}
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    </div>
                  );
                })}
              </div>

              {/* Botón de exploración de catálogo remoto */}
              <div className="pt-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCatalogOpen(true)}
                  className="w-full h-8 gap-1.5 text-xs font-bold text-primary border-primary/30 hover:bg-primary/10 transition-colors shadow-2xs"
                >
                  <Globe2 className="size-3.5" />
                  <span>Explorar Tienda & Catálogo</span>
                </Button>
              </div>
            </SidebarGroupContent>
          )}
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-border bg-card/60 p-2.5 text-center">
        <p className="text-[11px] font-medium text-muted-foreground">
          {busy ? (
            <span className="flex items-center justify-center gap-1.5 text-primary">
              <Sparkles className="size-3 animate-spin" /> Instalando paquete .abmod…
            </span>
          ) : (
            <span>Alethia Bridge · SQLite FTS5 Engine</span>
          )}
        </p>
      </SidebarFooter>

      <LibraryManagerModal
        open={catalogOpen}
        onOpenChange={setCatalogOpen}
        onModuleChanged={refresh}
      />
    </>
  );
}
