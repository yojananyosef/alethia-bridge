"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BookOpenText, PackagePlus, Trash2 } from "lucide-react";
import { Button } from "../components/ui/button";
import { Checkbox } from "../components/ui/checkbox";
import { Skeleton } from "../components/ui/skeleton";
import { PanelHeader } from "./PanelHeader";
import { useExegesisStore } from "../store/useExegesisStore";
import type { ModuleBook, ModuleInfo } from "../types/module";

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
      <button
        onClick={() => setSyncGroupA({ book: book.id, chapter: 1, verse: 1 })}
        className={`w-full rounded px-2 py-1 text-left text-sm ${
          isActive
            ? "bg-accent font-semibold text-primary"
            : "text-foreground hover:bg-accent"
        }`}
      >
        <BookOpenText className="mr-1 inline h-3.5 w-3.5" />
        {book.nombre}
      </button>
      {isActive && (
        <div className="mt-1 grid grid-cols-7 gap-1 pl-3">
          {Array.from({ length: chapters }, (_, i) => i + 1).map((c) => (
            <button
              key={c}
              onClick={() => setSyncGroupA({ book: book.id, chapter: c, verse: 1 })}
              className={`rounded px-1 py-0.5 text-xs ${
                syncGroupA.chapter === c
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent"
              }`}
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
    <aside className="flex h-full flex-col border-r border-border bg-card">
      <PanelHeader>Biblias</PanelHeader>
      <nav className="flex-1 overflow-y-auto p-2">
        {modules === null ? (
          <div className="space-y-2 px-2 py-1">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ) : primary ? (
          primary.books!.map((b) => (
            <BookItem key={b.id} book={b} chapters={b.capitulos} />
          ))
        ) : (
          <p className="px-2 text-xs text-muted-foreground">
            No hay módulos biblia activos.
          </p>
        )}
      </nav>
      <div className="border-t border-border px-3 py-2">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Módulos
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            title="Instalar .abmod"
          >
            <PackagePlus className="size-3.5" />
          </Button>
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
        </div>
        {error && <p className="mb-1 text-xs text-destructive">{error}</p>}
        {(modules ?? []).map((m) => (
          <div key={m.id} className="flex items-center gap-1.5 py-0.5 text-xs">
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
      </div>
    </aside>
  );
}
