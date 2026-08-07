"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useExegesisStore } from "../store/useExegesisStore";
import type { InterlinearModule, ReadResponse, VersePayload } from "../types/bible";
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

function VerseView({
  verseNo,
  modules,
}: {
  verseNo: number;
  modules: InterlinearModule[];
}) {
  const verses = useMemo(
    () => modules.map((m) => m.verses.find((v) => v.verse === verseNo)),
    [modules, verseNo],
  );
  if (!verses.some(Boolean)) return null;
  return (
    <div className="mb-3">
      <span className="float-left mr-1.5 text-sm font-bold text-[var(--accent)]">
        {verseNo}
      </span>
      {verses.map((v, i) => {
        if (!v) return null;
        return (
          <VerseText key={i} verse={v} isLast={i === verses.length - 1} />
        );
      })}
    </div>
  );
}

export function PanelCenterReader() {
  const { syncGroupA, activeModules } = useExegesisStore();
  const [data, setData] = useState<ReadResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
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
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [syncGroupA.book, syncGroupA.chapter, activeModules]);

  useEffect(() => {
    void load();
  }, [load]);

  const verses = data?.modules[0]?.verses ?? [];

  return (
    <main className="flex h-full flex-col bg-[var(--bg)]">
      <header className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--panel)] px-4 py-2">
        <h1 className="text-sm font-semibold">
          {syncGroupA.book} {syncGroupA.chapter}
          <span className="ml-2 text-xs font-normal text-[var(--muted)]">
            {data ? `${data.durationMs.toFixed(1)}ms · ${data.modules.length} módulos` : ""}
          </span>
        </h1>
        <div className="flex gap-1 text-[10px] uppercase tracking-wider text-[var(--muted)]">
          {data?.modules.map((m) => (
            <span key={m.moduleId} className="rounded bg-[var(--accent-soft)] px-1.5 py-0.5">
              {m.moduleId}
            </span>
          ))}
        </div>
      </header>
      <div className="flex-1 overflow-y-auto px-6 py-4 leading-relaxed">
        {error ? <p className="text-sm text-red-500">{error}</p> : null}
        {verses.map((v) => (
          <VerseView key={v.verse} verseNo={v.verse} modules={data?.modules ?? []} />
        ))}
      </div>
    </main>
  );
}
