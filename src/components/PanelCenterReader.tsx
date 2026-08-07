"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { Columns3, Rows3 } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "../components/ui/toggle-group";
import { useExegesisStore } from "../store/useExegesisStore";
import type { InterlinearModule, ReadResponse, VersePayload } from "../types/bible";
import type { ModuleInfo } from "../types/module";
import { WordTokenView } from "./interlinear/WordTokenView";

function VerseText({
  verse,
  isLast,
  dir,
  withLabels,
}: {
  verse: VersePayload;
  isLast: boolean;
  dir: "ltr" | "rtl";
  withLabels: boolean;
}) {
  return (
    <>
      <span dir={dir}>
        {verse.tokens.map((t) => (
          <Fragment key={t.id}>
            <WordTokenView token={t} dir={dir} withLabels={withLabels} />{" "}
          </Fragment>
        ))}
        {!isLast && " "}
      </span>
      {dir === "rtl" && " "}
    </>
  );
}

const LANG_LABEL: Record<string, string> = { es: "ES", el: "GR", he: "HE" };

/** Barra de módulos visible: crea/destruye la vista paralela con un clic. */
function ModuleBar({
  modules,
  activeModules,
  toggleModule,
}: {
  modules: ModuleInfo[];
  activeModules: string[];
  toggleModule: (id: string) => void;
}) {
  const bibles = modules.filter((m) => m.type === "bible" && m.status === "installed");
  return (
    <ToggleGroup
      size="sm"
      variant="outline"
      multiple
      value={activeModules}
      onValueChange={(next) => {
        const changed = bibles.find(
          (m) => next.includes(m.id) !== activeModules.includes(m.id),
        );
        if (changed) toggleModule(changed.id);
      }}
      aria-label="Módulos bíblicos activos"
    >
      {bibles.map((m) => {
        const active = activeModules.includes(m.id);
        return (
          <ToggleGroupItem
            key={m.id}
            value={m.id}
            title={`${active ? "Quitar" : "Añadir"} ${m.name} (${LANG_LABEL[m.language] ?? m.language})`}
            className="gap-1.5 px-2.5"
          >
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full ${
                active ? "bg-primary" : "bg-muted-foreground/40"
              }`}
            />
            {m.id}
            <span className="text-muted-foreground opacity-70">
              {LANG_LABEL[m.language] ?? ""}
            </span>
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );
}

function VerseView({
  verseNo,
  modules,
  layout,
}: {
  verseNo: number;
  modules: InterlinearModule[];
  layout: "interleaved" | "columns";
}) {
  const verses = useMemo(
    () =>
      modules.map((m) => ({
        verse: m.verses.find((v) => v.verse === verseNo),
        dir: (m.language === "he" ? "rtl" : "ltr") as "ltr" | "rtl",
        withLabels: m.language === "el" || m.language === "he",
      })),
    [modules, verseNo],
  );
  if (!verses.some((x) => x.verse)) return null;

  if (layout === "columns") {
    const colCount = Math.max(1, verses.filter((v) => v.verse).length);
    return (
      <div
        className="mb-4 grid gap-x-6 gap-y-1 border-b border-border pb-3 last:border-b-0"
        style={{ gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))` }}
      >
        {verses.map((v, i) => {
          if (!v.verse) return null;
          return (
            <div key={i}>
              <span className="mr-1.5 text-xs font-bold text-primary">{v.verse.verse}</span>
              <VerseText
                verse={v.verse}
                dir={v.dir}
                withLabels={v.withLabels}
                isLast={i === verses.length - 1}
              />
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="mb-4 flex gap-2">
      <span className="text-sm font-bold text-primary">{verseNo}</span>
      <div className="min-w-0 flex-1">
        {verses.map((v, i) => {
          if (!v.verse) return null;
          return (
            <div key={i} className={i > 0 ? "mt-1.5" : ""}>
              <VerseText
                verse={v.verse}
                dir={v.dir}
                withLabels={v.withLabels}
                isLast={i === verses.length - 1}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function PanelCenterReader() {
  const { syncGroupA, activeModules, toggleModule, readerLayout, setReaderLayout } =
    useExegesisStore();
  const [data, setData] = useState<ReadResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modules, setModules] = useState<ModuleInfo[]>([]);

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
  }, []);

  const load = useCallback(async () => {
    const params = new URLSearchParams({
      book: syncGroupA.book,
      chapter: String(syncGroupA.chapter),
      modules: activeModules.join(","),
    });
    try {
      const res = await fetch(`/api/bible/read?${params}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`API read falló: ${res.status}`);
      const body = (await res.json()) as ReadResponse;
      setData(body);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [syncGroupA.book, syncGroupA.chapter, activeModules]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  const verses = data?.modules[0]?.verses ?? [];

  return (
    <main className="flex h-full flex-col bg-background">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border bg-card px-4 py-2">
        <h1 className="text-sm font-semibold">
          {syncGroupA.book} {syncGroupA.chapter}
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            {data ? `${data.durationMs.toFixed(1)}ms` : ""}
          </span>
        </h1>
        <ModuleBar
          modules={modules}
          activeModules={activeModules}
          toggleModule={toggleModule}
        />
        <div className="ml-auto flex items-center gap-1">
          <ToggleGroup
            size="sm"
            variant="outline"
            value={[readerLayout]}
            onValueChange={(next) => {
              const v = next[0];
              if (v === "interleaved" || v === "columns") setReaderLayout(v);
            }}
            aria-label="Disposición del lector"
          >
            <ToggleGroupItem value="interleaved" title="Vista interlineal (textos en línea)">
              <Rows3 className="size-3.5" />
            </ToggleGroupItem>
            <ToggleGroupItem value="columns" title="Vista paralela (columnas por módulo)">
              <Columns3 className="size-3.5" />
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </header>
      <div className="flex-1 overflow-y-auto px-6 py-4 leading-relaxed">
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {data && verses.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Los módulos activos no tienen contenido para {syncGroupA.book} {syncGroupA.chapter}.
          </p>
        )}
        {verses.map((v) => (
          <VerseView
            key={v.verse}
            verseNo={v.verse}
            modules={data?.modules ?? []}
            layout={readerLayout}
          />
        ))}
      </div>
    </main>
  );
}
