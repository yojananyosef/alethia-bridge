"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Columns3, Rows3 } from "lucide-react";
import { useExegesisStore } from "../store/useExegesisStore";
import type { InterlinearModule, ReadResponse, VersePayload } from "../types/bible";
import type { ModuleInfo } from "../types/module";
import { WordTokenView } from "./interlinear/WordTokenView";

function VerseText({ verse, isLast }: { verse: VersePayload; isLast: boolean }) {
  const isGreek = verse.tokens.some((t) => /[\u0370-\u03FF\u1F00-\u1FFF]/u.test(t.text));
  return (
    <>
      {verse.tokens.map((t) => (
        <WordTokenView key={t.id} token={t} isGreek={isGreek} />
      ))}
      {!isLast && " "}
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
    <div className="flex flex-wrap items-center gap-1.5">
      {bibles.map((m) => {
        const active = activeModules.includes(m.id);
        return (
          <button
            key={m.id}
            onClick={() => toggleModule(m.id)}
            title={`${active ? "Quitar" : "Añadir"} ${m.name} (${LANG_LABEL[m.language] ?? m.language})`}
            className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] transition-colors ${
              active
                ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent)]"
            }`}
          >
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full ${
                active ? "bg-[var(--accent)]" : "bg-[var(--muted)]/40"
              }`}
            />
            {m.id}
            <span className="opacity-70">{LANG_LABEL[m.language] ?? ""}</span>
          </button>
        );
      })}
    </div>
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
    () => modules.map((m) => m.verses.find((v) => v.verse === verseNo)),
    [modules, verseNo],
  );
  if (!verses.some(Boolean)) return null;

  if (layout === "columns") {
    return (
      <div className="mb-4 grid grid-cols-2 gap-x-6 gap-y-1 border-b border-[var(--border)] pb-3 last:border-b-0 xl:grid-cols-3 2xl:grid-cols-4">
        {verses.map((v, i) => {
          if (!v) return null;
          return (
            <div key={i}>
              <span className="mr-1.5 text-xs font-bold text-[var(--accent)]">{v.verse}</span>
              <VerseText verse={v} isLast={i === verses.length - 1} />
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="mb-3">
      <span className="float-left mr-1.5 text-sm font-bold text-[var(--accent)]">{verseNo}</span>
      {verses.map((v, i) => {
        if (!v) return null;
        return <VerseText key={i} verse={v} isLast={i === verses.length - 1} />;
      })}
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
    <main className="flex h-full flex-col bg-[var(--bg)]">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-[var(--border)] bg-[var(--panel)] px-4 py-2">
        <h1 className="text-sm font-semibold">
          {syncGroupA.book} {syncGroupA.chapter}
          <span className="ml-2 text-xs font-normal text-[var(--muted)]">
            {data ? `${data.durationMs.toFixed(1)}ms` : ""}
          </span>
        </h1>
        <ModuleBar
          modules={modules}
          activeModules={activeModules}
          toggleModule={toggleModule}
        />
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => setReaderLayout("interleaved")}
            title="Vista interlineal (textos en línea)"
            className={`rounded border px-1.5 py-1 ${
              readerLayout === "interleaved"
                ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent)]"
            }`}
          >
            <Rows3 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setReaderLayout("columns")}
            title="Vista paralela (columnas por módulo)"
            className={`rounded border px-1.5 py-1 ${
              readerLayout === "columns"
                ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent)]"
            }`}
          >
            <Columns3 className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>
      <div className="flex-1 overflow-y-auto px-6 py-4 leading-relaxed">
        {error ? <p className="text-sm text-red-500">{error}</p> : null}
        {data && verses.length === 0 && (
          <p className="text-sm text-[var(--muted)]">
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
