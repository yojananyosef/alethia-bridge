"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BookOpenText, ChevronDown, PackagePlus, Trash2 } from "lucide-react";
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
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "../components/ui/sidebar";
import { useExegesisStore } from "../store/useExegesisStore";
import type { ModuleBook, ModuleInfo } from "../types/module";
import { cn } from "../lib/utils";

async function fetchModules(): Promise<ModuleInfo[]> {
  const res = await fetch("/api/modules", { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = (await res.json()) as { modules: ModuleInfo[] };
  return body.modules;
}

function BookItem({ book, chapters }: { book: ModuleBook; chapters: number }) {
  const { syncGroupA, setSyncGroupA } = useExegesisStore();
  const isActive = syncGroupA.book === book.id;
  return (
    <div className="px-1">
      <SidebarMenuButton
        isActive={isActive}
        onClick={() => setSyncGroupA({ book: book.id, chapter: 1, verse: 1 })}
        className="gap-2"
      >
        <BookOpenText />
        <span>{book.nombre}</span>
      </SidebarMenuButton>
      {isActive && (
        <div className="mt-1 grid grid-cols-7 gap-1 pl-3">
          {Array.from({ length: chapters }, (_, i) => i + 1).map((c) => (
            <button
              key={c}
              onClick={() => setSyncGroupA({ book: book.id, chapter: c, verse: 1 })}
              className={cn(
                "rounded px-1 py-0.5 text-xs transition-colors",
                syncGroupA.chapter === c
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent",
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
  const [modules, setModules] = useState<ModuleInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [biblesOpen, setBiblesOpen] = useState(true);
  const [modulesOpen, setModulesOpen] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      setModules(await fetchModules());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(refresh);
  }, [refresh]);

  /** Módulo biblia activo con el canon más completo (fuente de navegación). */
  const primary = useMemo(
    () =>
      (modules ?? [])
        .filter((m) => m.type === "bible" && m.status === "installed" && (m.books?.length ?? 0) > 0)
        .sort((a, b) => (b.books?.length ?? 0) - (a.books?.length ?? 0))[0] ?? null,
    [modules],
  );

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

  return (
    <>
      <SidebarHeader className="border-b border-border">
        <div className="flex h-8 items-center px-2">
          <span className="text-sm font-bold tracking-tight">
            Alethia<span className="text-primary">Bridge</span>
          </span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel
            className="cursor-pointer select-none gap-1"
            onClick={() => setBiblesOpen((o) => !o)}
            title={biblesOpen ? "Ocultar biblias" : "Mostrar biblias"}
          >
            <ChevronDown
              className={cn("size-3.5 transition-transform duration-150", !biblesOpen && "-rotate-90")}
            />
            Biblias
          </SidebarGroupLabel>
          {biblesOpen && (
            <SidebarGroupContent>
              {modules === null ? (
                <div className="space-y-2 px-2 py-1">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              ) : primary ? (
                <SidebarMenu>
                  {primary.books!.map((b) => (
                    <SidebarMenuItem key={b.id}>
                      <BookItem book={b} chapters={b.capitulos} />
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              ) : (
                <p className="px-2 py-1 text-xs text-muted-foreground">
                  No hay módulos biblia activos.
                </p>
              )}
            </SidebarGroupContent>
          )}
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel
            className="cursor-pointer select-none gap-1"
            onClick={() => setModulesOpen((o) => !o)}
            title={modulesOpen ? "Ocultar módulos" : "Mostrar módulos"}
          >
            <ChevronDown
              className={cn("size-3.5 transition-transform duration-150", !modulesOpen && "-rotate-90")}
            />
            Módulos
          </SidebarGroupLabel>
          <SidebarGroupAction onClick={() => fileRef.current?.click()} title="Instalar .abmod">
            <PackagePlus />
          </SidebarGroupAction>
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
            <SidebarGroupContent>
              {error && <p className="px-2 py-1 text-xs text-destructive">{error}</p>}
              {(modules ?? []).map((m) => (
                <div key={m.id} className="flex items-center gap-1.5 px-2 py-0.5 text-xs">
                  <Checkbox
                    checked={m.status === "installed"}
                    onCheckedChange={() => void toggle(m)}
                    aria-label={`Habilitar ${m.id}`}
                  />
                  <span className="flex-1 truncate" title={`${m.name} v${m.version} · ${m.type}`}>
                    {m.id}
                    <span className="ml-1 text-[10px] text-muted-foreground">v{m.version}</span>
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => void uninstall(m)}
                    className="hover:bg-destructive/10 hover:text-destructive"
                    title={`Desinstalar ${m.id}`}
                  >
                    <Trash2 className="size-3" />
                  </Button>
                </div>
              ))}
            </SidebarGroupContent>
          )}
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-border">
        <p className="px-2 py-1 text-[10px] leading-relaxed text-muted-foreground">
          {busy ? "Instalando módulo…" : "Ctrl+B colapsa la barra lateral"}
        </p>
      </SidebarFooter>
    </>
  );
}
