"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Columns3,
  Copy,
  Check,
  Globe2,
  Highlighter,
  Rows3,
  Sparkles,
  Type,
  Tag,
  BookOpen,
} from "lucide-react";
import { LibraryManagerModal } from "./catalog/LibraryManagerModal";
import { ToggleGroup, ToggleGroupItem } from "../components/ui/toggle-group";
import { Button } from "../components/ui/button";
import { useExegesisStore } from "../store/useExegesisStore";
import { listClientModules } from "../lib/modules/client-registry";
import { readChapter as readChapterClient } from "../lib/bible/client-service";
import type { InterlinearModule, ReadResponse, VersePayload } from "../types/bible";
import type { ModuleInfo } from "../types/module";
import { CANON } from "../lib/canon";
import { WordTokenView } from "./interlinear/WordTokenView";
import { addHighlight, clearHighlightsForVerse, highlightsForVerse, notesForVerse } from "../lib/db/dexie-user-db";
import { cn } from "../lib/utils";

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
      <span dir={dir} className="inline leading-relaxed">
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

function VerseView({
  verseNo,
  bookId,
  chapterNo,
  modules,
  layout,
  highlightColor,
  onOpenNotes,
  onSelectVerse,
}: {
  verseNo: number;
  bookId: string;
  chapterNo: number;
  modules: InterlinearModule[];
  layout: "interleaved" | "columns";
  highlightColor: string | null;
  onOpenNotes: (verseId: string) => void;
  onSelectVerse: (verseNo: number) => void;
}) {
  const [hasNotes, setHasNotes] = useState(false);
  const [hlColor, setHlColor] = useState<string | null>(null);
  const verseRef = `${bookId} ${chapterNo}:${verseNo}`;

  useEffect(() => {
    let cancelled = false;
    notesForVerse(verseRef)
      .then((notes) => {
        if (!cancelled) setHasNotes(notes.length > 0);
      })
      .catch(() => {});

    highlightsForVerse(verseRef)
      .then((hls) => {
        if (!cancelled && hls.length > 0) {
          setHlColor(hls[hls.length - 1].color);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [verseRef]);

  const verses = useMemo(
    () =>
      modules.map((m) => ({
        moduleId: m.moduleId,
        verse: m.verses.find((v) => v.verse === verseNo),
        dir: (m.language === "he" ? "rtl" : "ltr") as "ltr" | "rtl",
        withLabels: m.language === "el" || m.language === "he" || m.language === "es",
      })),
    [modules, verseNo],
  );

  const handleVerseClick = async () => {
    onSelectVerse(verseNo);
    if (highlightColor) {
      if (highlightColor === "clear" || hlColor === highlightColor) {
        setHlColor(null);
        await clearHighlightsForVerse(verseRef);
      } else {
        setHlColor(highlightColor);
        await clearHighlightsForVerse(verseRef);
        await addHighlight({
          verse_id: verseRef,
          start_offset: 0,
          end_offset: 0,
          color: highlightColor,
          date: new Date().toISOString(),
        });
      }
    }
  };

  if (!verses.some((x) => x.verse)) return null;

  const hlClass =
    hlColor === "yellow"
      ? "hl-yellow"
      : hlColor === "green"
      ? "hl-green"
      : hlColor === "blue"
      ? "hl-blue"
      : hlColor === "pink"
      ? "hl-pink"
      : "";

  if (layout === "columns") {
    const activeColumns = verses.filter((v) => v.verse);
    const colCount = Math.max(1, activeColumns.length);
    return (
      <div
        onClick={handleVerseClick}
        className={cn(
          "group/verse relative mb-4 grid gap-x-6 gap-y-2 border-b border-border/60 pb-3.5 transition-colors duration-150 last:border-b-0",
          hlClass,
        )}
        style={{ gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))` }}
      >
        {activeColumns.map((v, i) => {
          if (!v.verse) return null;
          return (
            <div key={v.moduleId} className="relative min-w-0">
              <div className="flex items-center gap-1.5 mb-1 text-[11px] font-mono font-bold text-primary">
                <span>{v.verse.verse}</span>
                <span className="text-[10px] text-muted-foreground font-normal">[{v.moduleId}]</span>
                {i === 0 && hasNotes && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectVerse(verseNo);
                      onOpenNotes(verseRef);
                    }}
                    className="text-[10px] bg-primary/10 text-primary px-1 rounded hover:bg-primary/20"
                    title="Ver notas de este versículo"
                  >
                    📝 Nota
                  </button>
                )}
              </div>
              <VerseText
                verse={v.verse}
                dir={v.dir}
                withLabels={v.withLabels}
                isLast={i === activeColumns.length - 1}
              />
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div
      onClick={handleVerseClick}
      className={cn(
        "group/verse relative mb-4 flex items-start gap-3 rounded-lg p-2 transition-colors duration-150",
        hlClass,
      )}
    >
      <div className="flex flex-col items-center gap-1 pt-0.5 select-none">
        <span className="font-mono text-xs font-bold text-primary">{verseNo}</span>
        {hasNotes && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSelectVerse(verseNo);
              onOpenNotes(verseRef);
            }}
            className="text-[10px] text-primary hover:scale-110 transition-transform"
            title="Ver notas de este versículo"
          >
            📝
          </button>
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-1.5">
        {verses.map((v, i) => {
          if (!v.verse) return null;
          return (
            <div key={v.moduleId} className={cn(i > 0 && "pt-1 border-t border-border/30")}>
              <span className="mr-2 inline-block rounded bg-muted/60 px-1 py-0.2 font-mono text-[9px] font-semibold text-muted-foreground select-none">
                {v.moduleId}
              </span>
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
  const {
    syncGroupA,
    setSyncGroupA,
    activeModules,
    installedModules,
    toggleModule,
    readerLayout,
    setReaderLayout,
    fontSize,
    setFontSize,
    showStrongs,
    setShowStrongs,
    showMorphology,
    setShowMorphology,
    activeHighlightColor,
    setActiveHighlightColor,
    setActiveLexiconTerm,
    modulesRevision,
    bumpModulesRevision,
  } = useExegesisStore();

  const [data, setData] = useState<ReadResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modules, setModules] = useState<ModuleInfo[]>([]);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listClientModules()
      .then((list) => {
        if (!cancelled) {
          setModules(list);
          const bibles = list.filter((m) => m.type === "bible" && m.status === "installed");
          if (bibles.length > 0 && useExegesisStore.getState().activeModules.length === 0) {
            toggleModule(bibles[0].id);
          }
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [modulesRevision, toggleModule]);

  const chapterCacheRef = useRef<Map<string, ReadResponse>>(new Map());

  const load = useCallback(async () => {
    const active = activeModules.length > 0 ? activeModules : null;
    const cacheKey = `${syncGroupA.book}:${syncGroupA.chapter}:${active?.join(",") ?? ""}`;
    const cached = chapterCacheRef.current.get(cacheKey);
    if (cached) {
      setData(cached);
      setError(null);
      return;
    }

    try {
      const body = await readChapterClient(syncGroupA.book, String(syncGroupA.chapter), active);
      if (chapterCacheRef.current.size > 50) chapterCacheRef.current.clear();
      chapterCacheRef.current.set(cacheKey, body);
      setData(body);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [syncGroupA.book, syncGroupA.chapter, activeModules]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load, modulesRevision]);

  // Navegación por capítulos (Anterior / Siguiente)
  const currentCanonBook = useMemo(
    () => CANON.find((b) => b.id === syncGroupA.book) ?? null,
    [syncGroupA.book],
  );

  const prevChapter = () => {
    if (!currentCanonBook) return;
    if (syncGroupA.chapter > 1) {
      setSyncGroupA({ ...syncGroupA, chapter: syncGroupA.chapter - 1, verse: 1 });
    } else {
      // Ir al libro anterior si existe
      const idx = CANON.findIndex((b) => b.id === syncGroupA.book);
      if (idx > 0) {
        const prev = CANON[idx - 1];
        setSyncGroupA({ book: prev.id, chapter: prev.capitulos, verse: 1 });
      }
    }
  };

  const nextChapter = () => {
    if (!currentCanonBook) return;
    if (syncGroupA.chapter < currentCanonBook.capitulos) {
      setSyncGroupA({ ...syncGroupA, chapter: syncGroupA.chapter + 1, verse: 1 });
    } else {
      // Ir al libro siguiente si existe
      const idx = CANON.findIndex((b) => b.id === syncGroupA.book);
      if (idx >= 0 && idx < CANON.length - 1) {
        const next = CANON[idx + 1];
        setSyncGroupA({ book: next.id, chapter: 1, verse: 1 });
      }
    }
  };

  // Copiar todo el capítulo con formato académico
  const copyPassage = async () => {
    if (!data) return;
    const lines: string[] = [`=== ${syncGroupA.book} ${syncGroupA.chapter} ===\n`];
    for (const mod of data.modules) {
      lines.push(`-- [${mod.moduleId}] --`);
      for (const v of mod.verses) {
        lines.push(`${v.verse}. ${v.text}`);
      }
      lines.push("");
    }
    await navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Extraer versículos disponibles en este capítulo desde cualquier módulo activo con texto
  const verses = useMemo(() => {
    const withVerses = data?.modules.find((m) => m.verses && m.verses.length > 0);
    if (withVerses) return withVerses.verses;

    // Si varios módulos tienen versículos parciales, unificar por número de versículo
    const verseMap = new Map<number, { verse: number; text: string }>();
    for (const mod of data?.modules ?? []) {
      for (const v of mod.verses) {
        if (!verseMap.has(v.verse)) {
          verseMap.set(v.verse, { verse: v.verse, text: v.text });
        }
      }
    }
    return Array.from(verseMap.values()).sort((a, b) => a.verse - b.verse);
  }, [data]);

  const sizeClass =
    fontSize === "sm"
      ? "reader-size-sm"
      : fontSize === "lg"
      ? "reader-size-lg"
      : fontSize === "xl"
      ? "reader-size-xl"
      : "reader-size-base";

  return (
    <main className="flex h-full flex-col bg-background select-text">
      {/* Header del Lector con controles adaptables y altura h-12 alineada */}
      <header className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-border bg-card/80 px-3 sm:px-4 backdrop-blur-xs z-10">
        {/* Pasaje y navegación de capítulos */}
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-border bg-background p-0.5 shadow-2xs">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={prevChapter}
              title="Capítulo anterior"
              aria-label="Capítulo anterior"
              className="size-7"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <div className="flex items-center gap-1.5 px-2">
              <BookOpen className="size-3.5 text-primary shrink-0" />
              <h1 className="text-xs sm:text-sm font-bold tracking-tight truncate max-w-[130px] sm:max-w-none">
                {currentCanonBook?.nombre ?? syncGroupA.book} {syncGroupA.chapter}
              </h1>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={nextChapter}
              title="Capítulo siguiente"
              aria-label="Capítulo siguiente"
              className="size-7"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>

          <span className="hidden sm:inline font-mono text-[11px] text-muted-foreground">
            {data ? `${data.durationMs.toFixed(1)}ms` : ""}
          </span>
        </div>

        {/* Herramientas de visualización y estudio en DESKTOP (md+) */}
        <div className="hidden md:flex items-center gap-1.5">
          {/* Selector de Tamaño de Fuente */}
          <ToggleGroup
            size="sm"
            variant="outline"
            value={[fontSize]}
            onValueChange={(val) => {
              const v = val[0];
              if (v === "sm" || v === "base" || v === "lg" || v === "xl") setFontSize(v);
            }}
            aria-label="Tamaño del texto"
          >
            <ToggleGroupItem value="sm" title="Texto Pequeño" className="px-1.5 text-[11px]">
              A-
            </ToggleGroupItem>
            <ToggleGroupItem value="base" title="Texto Estándar" className="px-1.5 text-xs font-semibold">
              A
            </ToggleGroupItem>
            <ToggleGroupItem value="lg" title="Texto Grande" className="px-1.5 text-xs font-bold">
              A+
            </ToggleGroupItem>
          </ToggleGroup>

          {/* Toggle Strongs y Morfología */}
          <Button
            variant={showStrongs ? "secondary" : "ghost"}
            size="icon-sm"
            onClick={() => setShowStrongs(!showStrongs)}
            title={showStrongs ? "Ocultar números Strong" : "Mostrar números Strong"}
            className="size-7"
          >
            <Tag className={cn("size-3.5", showStrongs ? "text-primary font-bold" : "text-muted-foreground")} />
          </Button>

          <Button
            variant={showMorphology ? "secondary" : "ghost"}
            size="icon-sm"
            onClick={() => setShowMorphology(!showMorphology)}
            title={showMorphology ? "Ocultar códigos morfológicos" : "Mostrar códigos morfológicos"}
            className="size-7"
          >
            <Type className={cn("size-3.5", showMorphology ? "text-primary font-bold" : "text-muted-foreground")} />
          </Button>

          {/* Resaltador de Color */}
          <div className="flex items-center gap-0.5 rounded-lg border border-border bg-background p-0.5">
            <Highlighter className="size-3.5 text-muted-foreground ml-1 mr-0.5" />
            <button
              onClick={() => setActiveHighlightColor(activeHighlightColor === "yellow" ? null : "yellow")}
              className={cn(
                "size-4 rounded-full bg-amber-300 border transition-transform",
                activeHighlightColor === "yellow" ? "scale-125 border-primary ring-1 ring-primary" : "border-transparent opacity-80",
              )}
              title="Resaltador Amarillo (clic en versículo)"
            />
            <button
              onClick={() => setActiveHighlightColor(activeHighlightColor === "green" ? null : "green")}
              className={cn(
                "size-4 rounded-full bg-emerald-300 border transition-transform",
                activeHighlightColor === "green" ? "scale-125 border-primary ring-1 ring-primary" : "border-transparent opacity-80",
              )}
              title="Resaltador Verde (clic en versículo)"
            />
            <button
              onClick={() => setActiveHighlightColor(activeHighlightColor === "blue" ? null : "blue")}
              className={cn(
                "size-4 rounded-full bg-sky-300 border transition-transform",
                activeHighlightColor === "blue" ? "scale-125 border-primary ring-1 ring-primary" : "border-transparent opacity-80",
              )}
              title="Resaltador Azul (clic en versículo)"
            />
            <button
              onClick={() => setActiveHighlightColor(activeHighlightColor === "pink" ? null : "pink")}
              className={cn(
                "size-4 rounded-full bg-pink-300 border transition-transform",
                activeHighlightColor === "pink" ? "scale-125 border-primary ring-1 ring-primary" : "border-transparent opacity-80",
              )}
              title="Resaltador Rosa (clic en versículo)"
            />
            {activeHighlightColor && (
              <button
                onClick={() => setActiveHighlightColor("clear")}
                className="text-[10px] text-muted-foreground px-1 hover:text-foreground font-mono"
                title="Modo borrar resaltado"
              >
                ✕
              </button>
            )}
          </div>

          {/* Copiar Pasaje */}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => void copyPassage()}
            title="Copiar texto del pasaje"
            className="size-7"
          >
            {copied ? <Check className="size-3.5 text-primary" /> : <Copy className="size-3.5" />}
          </Button>

          {/* Toggle de Layout: Interleaved / Columns */}
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

        {/* Herramientas compactas en MÓVIL (<md) */}
        <div className="flex md:hidden items-center gap-1">
          {/* Tamaño de fuente móvil rápido */}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => {
              const cycle = { sm: "base", base: "lg", lg: "xl", xl: "sm" } as const;
              setFontSize(cycle[fontSize] ?? "base");
            }}
            title={`Tamaño actual: ${fontSize.toUpperCase()} (Tocar para cambiar)`}
            className="size-7 text-[11px] font-bold font-mono"
          >
            {fontSize === "sm" ? "A-" : fontSize === "lg" ? "A+" : fontSize === "xl" ? "A++" : "A"}
          </Button>

          {/* Copiar pasaje */}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => void copyPassage()}
            title="Copiar texto del capítulo"
            className="size-7"
          >
            {copied ? <Check className="size-3.5 text-primary" /> : <Copy className="size-3.5" />}
          </Button>
        </div>
      </header>

      {/* Contenedor del Texto Bíblico */}
      <div className={cn("flex-1 overflow-y-auto px-3.5 py-4 sm:px-6 sm:py-6 scrollbar-thin", sizeClass)}>
        {error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        {verses.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center max-w-md mx-auto space-y-4">
            <div className="size-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-xs">
              <BookOpen className="size-8" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-lg font-bold text-foreground">
                {modules.filter((m) => m.type === "bible" && m.status === "installed").length === 0
                  ? "¡Bienvenido a Alethia Bridge!"
                  : "Sin contenido para este capítulo"}
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {modules.filter((m) => m.type === "bible" && m.status === "installed").length === 0
                  ? "Aún no tienes ninguna versión bíblica instalada. Explora la biblioteca para instalar Reina-Valera 1909, Griego SBLGNT, Hebreo WLC y otros recursos exegéticos."
                  : `Los módulos activos no disponen del texto de ${syncGroupA.book} ${syncGroupA.chapter}. Prueba seleccionando otro módulo desde la cabecera.`}
              </p>
            </div>
            <Button
              onClick={() => setCatalogOpen(true)}
              className="gap-2 font-semibold shadow-md bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Globe2 className="size-4" />
              <span>Explorar Biblioteca de Módulos</span>
            </Button>
          </div>
        )}

        {verses.map((v) => (
          <VerseView
            key={v.verse}
            verseNo={v.verse}
            bookId={syncGroupA.book}
            chapterNo={syncGroupA.chapter}
            modules={data?.modules ?? []}
            layout={readerLayout}
            highlightColor={activeHighlightColor}
            onSelectVerse={(verseNo) => {
              // Seleccionar el versículo activo: el panel derecho (análisis/notas)
              // y la navegación posterior apuntan a este versículo.
              if (syncGroupA.verse !== verseNo) {
                setSyncGroupA({ ...syncGroupA, verse: verseNo });
              }
            }}
            onOpenNotes={() => {
              // Enfocar el pasaje del versículo en el panel derecho (notas)
              setActiveLexiconTerm(null);
            }}
          />
        ))}
      </div>

      <LibraryManagerModal
        open={catalogOpen}
        onOpenChange={setCatalogOpen}
        onModuleChanged={() => {
          bumpModulesRevision();
          void load();
        }}
      />
    </main>
  );
}
