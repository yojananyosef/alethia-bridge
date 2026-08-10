"use client";

import React, { useCallback, useMemo } from "react";
import { BookOpen, Sparkles, Tag } from "lucide-react";
import { parseLexiconRef, type ParsedVerseRef } from "../../lib/bible/reference-parser";
import { useExegesisStore } from "../../store/useExegesisStore";
import { cn } from "../../lib/utils";

interface LexiconDefinitionViewProps {
  detailedDefinition?: string | null;
  shortDefinition?: string | null;
  className?: string;
  onNavigateReference?: (ref: ParsedVerseRef) => void;
  onSelectStrong?: (strongId: string) => void;
}

interface LexiconBlock {
  id: string;
  type: "lead" | "major-section" | "subsection" | "sub-item" | "sub-lemma" | "lxx-note" | "attribution" | "paragraph";
  marker?: string;
  title?: string;
  rawText: string;
}

/**
 * Tokeniza texto plano con etiquetas HTML inline (<ref>, <b>, <i>, <u>, <sup>, etc.)
 * y genera elementos React interactivos y formateados.
 */
export function LexiconInlineContent({
  content,
  onNavigateReference,
  onSelectStrong,
}: {
  content: string;
  onNavigateReference?: (ref: ParsedVerseRef) => void;
  onSelectStrong?: (strongId: string) => void;
}) {
  const { setSyncGroupA, setActiveLexiconTerm } = useExegesisStore();

  const handleRefClick = useCallback(
    (e: React.MouseEvent, refTarget: string, visibleText: string) => {
      e.preventDefault();
      e.stopPropagation();

      const refs = parseLexiconRef(refTarget || visibleText);
      if (refs.length > 0) {
        const target = refs[0];
        if (onNavigateReference) {
          onNavigateReference(target);
        } else {
          setSyncGroupA({
            book: target.book,
            chapter: target.chapter,
            verse: target.verse,
          });
        }
      }
    },
    [onNavigateReference, setSyncGroupA],
  );

  const handleStrongClick = useCallback(
    (e: React.MouseEvent, strongId: string) => {
      e.preventDefault();
      e.stopPropagation();
      if (onSelectStrong) {
        onSelectStrong(strongId);
      } else {
        setActiveLexiconTerm(strongId);
      }
    },
    [onSelectStrong, setActiveLexiconTerm],
  );

  // Parser de tokens XML/HTML y texto enriquecido
  const elements = useMemo(() => {
    if (!content) return null;

    // Normalizar entidades HTML
    const decoded = content
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, " ");

    // Tokenizar etiquetas: <ref...>, <b>, </b>, <i>, </i>, <u>, </u>, <sup>, </sup>, etc.
    const tagRegex = /(<ref(?:=['"][^'"]*['"]|\s+target=['"][^'"]*['"])?[^>]*>[\s\S]*?<\/ref>|<ref[^>]*\/>|<b\b[^>]*>[\s\S]*?<\/b>|<i\b[^>]*>[\s\S]*?<\/i>|<u\b[^>]*>[\s\S]*?<\/u>|<sup\b[^>]*>[\s\S]*?<\/sup>|<sub\b[^>]*>[\s\S]*?<\/sub>|<greek\b[^>]*>[\s\S]*?<\/greek>|<hebrew\b[^>]*>[\s\S]*?<\/hebrew>|[GH]\d{3,5})/gi;

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    const renderTextFragment = (str: string, keyPrefix: string): React.ReactNode => {
      if (!str) return null;

      // Buscar fragmentos en Griego o Hebreo para tipografía académica
      const scriptRegex = /([\u0370-\u03FF\u1F00-\u1FFF]+|[\u0590-\u05FF]+)/g;
      const scriptParts = str.split(scriptRegex);

      return (
        <span key={keyPrefix}>
          {scriptParts.map((sub, idx) => {
            if (/[\u0370-\u03FF\u1F00-\u1FFF]/.test(sub)) {
              return (
                <span key={`${keyPrefix}-grk-${idx}`} className="font-ancient-greek text-[1.12em] font-medium text-foreground tracking-wide">
                  {sub}
                </span>
              );
            }
            if (/[\u0590-\u05FF]/.test(sub)) {
              return (
                <span key={`${keyPrefix}-heb-${idx}`} className="font-ancient-hebrew text-[1.2em] font-medium text-foreground" dir="rtl">
                  {sub}
                </span>
              );
            }
            return sub;
          })}
        </span>
      );
    };

    let tokenCounter = 0;

    while ((match = tagRegex.exec(decoded)) !== null) {
      const matchIndex = match.index;
      const fullMatch = match[0];

      // Texto precedente
      if (matchIndex > lastIndex) {
        const textBefore = decoded.substring(lastIndex, matchIndex);
        parts.push(renderTextFragment(textBefore, `txt-${tokenCounter++}`));
      }

      lastIndex = matchIndex + fullMatch.length;

      // Caso 1: <ref='...'>...</ref> o <ref target='...'>...</ref>
      const refMatch = fullMatch.match(/<ref(?:=(?:'([^']*)'|"([^"]*)")|\s+target=(?:'([^']*)'|"([^"]*)"))?[^>]*>([\s\S]*?)<\/ref>/i);
      if (refMatch) {
        const targetStr = refMatch[1] || refMatch[2] || refMatch[3] || refMatch[4] || "";
        const labelText = refMatch[5] || targetStr;
        const parsed = parseLexiconRef(targetStr || labelText);
        const hasValidRef = parsed.length > 0;

        parts.push(
          <button
            key={`ref-${tokenCounter++}`}
            type="button"
            onClick={(e) => handleRefClick(e, targetStr, labelText)}
            title={hasValidRef ? `Ir a pasaje ${parsed[0].book} ${parsed[0].chapter}:${parsed[0].verse}` : `Referencia: ${labelText}`}
            className={cn(
              "inline-flex items-center gap-1 font-mono text-[11px] font-bold text-primary bg-primary/10 hover:bg-primary/20 border border-primary/25 rounded-md px-1.5 py-0.2 mx-0.5 transition-all shadow-2xs hover:scale-102 cursor-pointer align-baseline",
              !hasValidRef && "opacity-80",
            )}
          >
            <BookOpen className="size-2.5 shrink-0 opacity-70" />
            <span>{labelText}</span>
          </button>,
        );
        continue;
      }

      // Caso 2: <b>...</b>
      const bMatch = fullMatch.match(/<b\b[^>]*>([\s\S]*?)<\/b>/i);
      if (bMatch) {
        parts.push(
          <strong key={`b-${tokenCounter++}`} className="font-bold text-foreground">
            {renderTextFragment(bMatch[1], `b-in-${tokenCounter}`)}
          </strong>,
        );
        continue;
      }

      // Caso 3: <i>...</i>
      const iMatch = fullMatch.match(/<i\b[^>]*>([\s\S]*?)<\/i>/i);
      if (iMatch) {
        parts.push(
          <em key={`i-${tokenCounter++}`} className="italic font-serif text-foreground/90 font-medium">
            {renderTextFragment(iMatch[1], `i-in-${tokenCounter}`)}
          </em>,
        );
        continue;
      }

      // Caso 4: <u>...</u>
      const uMatch = fullMatch.match(/<u\b[^>]*>([\s\S]*?)<\/u>/i);
      if (uMatch) {
        parts.push(
          <span key={`u-${tokenCounter++}`} className="underline decoration-primary/40 underline-offset-2">
            {renderTextFragment(uMatch[1], `u-in-${tokenCounter}`)}
          </span>,
        );
        continue;
      }

      // Caso 5: <sup>...</sup> y <sub>...</sub>
      const supMatch = fullMatch.match(/<sup\b[^>]*>([\s\S]*?)<\/sup>/i);
      if (supMatch) {
        parts.push(
          <sup key={`sup-${tokenCounter++}`} className="text-[9px] font-mono text-primary font-semibold">
            {supMatch[1]}
          </sup>,
        );
        continue;
      }

      // Caso 6: Strong ID suelto (ej. H3389, G2532)
      if (/^[GH]\d{3,5}$/i.test(fullMatch)) {
        const strongId = fullMatch.toUpperCase();
        parts.push(
          <button
            key={`strong-${tokenCounter++}`}
            type="button"
            onClick={(e) => handleStrongClick(e, strongId)}
            title={`Consultar Strong ${strongId}`}
            className="inline-flex items-center font-mono text-[10px] font-bold text-primary bg-primary/10 hover:bg-primary/20 border border-primary/20 rounded px-1 py-0.2 mx-0.5 transition-colors cursor-pointer"
          >
            {strongId}
          </button>,
        );
        continue;
      }

      // Fallback
      parts.push(renderTextFragment(fullMatch, `raw-${tokenCounter++}`));
    }

    if (lastIndex < decoded.length) {
      parts.push(renderTextFragment(decoded.substring(lastIndex), `txt-end-${tokenCounter++}`));
    }

    return parts;
  }, [content, handleRefClick, handleStrongClick]);

  return <>{elements}</>;
}

/**
 * Parsea el texto del léxico en bloques semánticos jerárquicos:
 * - Secciones Principales (I, II, III...)
 * - Subsecciones (1, 2, 3...)
 * - Incisos ((a), (b), (c)...)
 * - Sub-lemas (<b>lema</b>, contr. fr....)
 * - Notas Septuaginta ([in LXX...])
 */
function parseLexiconOutline(detailedText?: string | null): LexiconBlock[] {
  if (!detailedText) return [];

  // Normalizar saltos de línea HTML
  const normalized = detailedText
    .replace(/<BR\s*\/?>/gi, "\n")
    .replace(/\r\n/g, "\n");

  const rawLines = normalized
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  const blocks: LexiconBlock[] = [];

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    const id = `block-${i}`;

    // 1. Detección de Sección Principal (ej: __I. Copulative, __II. Adjunctive...)
    const majorMatch = line.match(/^_{0,3}(I|II|III|IV|V|VI|VII|VIII|IX|X)\.\s*(.*)/i);
    if (majorMatch) {
      blocks.push({
        id,
        type: "major-section",
        marker: `${majorMatch[1].toUpperCase()}.`,
        title: majorMatch[2],
        rawText: majorMatch[2] || line,
      });
      continue;
    }

    // 2. Detección de Subsección Numerada (ej: __1. Connecting single words, 1) first...)
    const subSecMatch = line.match(/^_{0,3}(\d+)[.)]\s*(.*)/);
    if (subSecMatch) {
      blocks.push({
        id,
        type: "subsection",
        marker: `${subSecMatch[1]}.`,
        title: subSecMatch[2],
        rawText: subSecMatch[2] || line,
      });
      continue;
    }

    // 3. Detección de Inciso de Letra (ej: __(a) in general, __(b) connecting..., 1a) beginning...)
    const subItemMatch = line.match(/^_{0,3}(?:\{?\s*)?\(?([a-zα-ω]|with|\d+[a-z])\)\s*(.*)/i);
    if (subItemMatch) {
      const cleanMarker = subItemMatch[1].toLowerCase();
      blocks.push({
        id,
        type: "sub-item",
        marker: `(${cleanMarker})`,
        title: subItemMatch[2],
        rawText: subItemMatch[2] || line,
      });
      continue;
    }

    // 4. Detección de Sub-lema o entrada compuesta (ej: <b>ἐάν</b>, contr. fr. εἰ ἄν...)
    const subLemmaMatch = line.match(/^<b>([A-Za-z\u0370-\u03FF\u1F00-\u1FFF\u0590-\u05FF]+)<\/b>,?\s*(.*)/i);
    if (subLemmaMatch && i > 2) {
      blocks.push({
        id,
        type: "sub-lemma",
        marker: subLemmaMatch[1],
        title: subLemmaMatch[2],
        rawText: line,
      });
      continue;
    }

    // 5. Nota LXX / Septuaginta (ej: [in LXX chiefly for...])
    if (/^\[in LXX/i.test(line) || /^\[chiefly for/i.test(line)) {
      blocks.push({
        id,
        type: "lxx-note",
        marker: "LXX",
        rawText: line,
      });
      continue;
    }

    // 6. Atribución de fuente final (ej: (AS), (LSJ), (BDB), (Thayer))
    if (/^\((?:AS|LSJ|BDB|Thayer|Tdf|WH|M|Deiss|WM)[^)]*\)$/i.test(line)) {
      blocks.push({
        id,
        type: "attribution",
        marker: line.replace(/[()]/g, ""),
        rawText: line,
      });
      continue;
    }

    // 7. Párrafo introductorio o general
    blocks.push({
      id,
      type: i === 0 ? "lead" : "paragraph",
      rawText: line,
    });
  }

  return blocks;
}

/**
 * Componente de visualización académica y elegante de entradas de léxico
 * (Abbott-Smith, BDB, STEPBible, Strongs).
 */
export function LexiconDefinitionView({
  detailedDefinition,
  shortDefinition,
  className,
  onNavigateReference,
  onSelectStrong,
}: LexiconDefinitionViewProps) {
  const blocks = useMemo(() => parseLexiconOutline(detailedDefinition), [detailedDefinition]);

  if (!detailedDefinition && !shortDefinition) {
    return null;
  }

  return (
    <div className={cn("space-y-3 text-xs leading-relaxed", className)}>
      {/* Definición Breve de cabecera */}
      {shortDefinition && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs font-semibold text-foreground flex items-start gap-2 shadow-2xs">
          <Sparkles className="size-3.5 text-primary shrink-0 mt-0.5" />
          <div className="min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-primary block mb-0.5">
              Definición Concisa
            </span>
            <p className="text-xs text-foreground/90 leading-relaxed font-medium">
              <LexiconInlineContent
                content={shortDefinition}
                onNavigateReference={onNavigateReference}
                onSelectStrong={onSelectStrong}
              />
            </p>
          </div>
        </div>
      )}

      {/* Bloques Jerárquicos de la Definición Detallada */}
      {blocks.length > 0 && (
        <div className="space-y-2 pt-1">
          {blocks.map((b) => {
            // Sección Principal (I, II, III...)
            if (b.type === "major-section") {
              return (
                <div
                  key={b.id}
                  className="mt-3.5 pt-2 border-t border-border/80 first:border-t-0 first:mt-0 first:pt-0"
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="inline-flex items-center justify-center font-mono text-[11px] font-extrabold bg-primary text-primary-foreground px-2 py-0.5 rounded-md shadow-2xs shrink-0">
                      {b.marker}
                    </span>
                    <h3 className="text-xs font-bold text-foreground tracking-tight">
                      <LexiconInlineContent
                        content={b.title || b.rawText}
                        onNavigateReference={onNavigateReference}
                        onSelectStrong={onSelectStrong}
                      />
                    </h3>
                  </div>
                </div>
              );
            }

            // Subsección numerada (1., 2., 3...)
            if (b.type === "subsection") {
              return (
                <div
                  key={b.id}
                  className="ml-1.5 pl-2.5 border-l-2 border-primary/30 space-y-1 py-1"
                >
                  <div className="flex items-start gap-1.5">
                    <span className="font-mono text-[11px] font-extrabold text-primary shrink-0 bg-primary/10 px-1.5 py-0.2 rounded border border-primary/20">
                      {b.marker}
                    </span>
                    <div className="text-[11.5px] text-foreground leading-relaxed flex-1">
                      <LexiconInlineContent
                        content={b.title || b.rawText}
                        onNavigateReference={onNavigateReference}
                        onSelectStrong={onSelectStrong}
                      />
                    </div>
                  </div>
                </div>
              );
            }

            // Inciso ((a), (b), (c)...)
            if (b.type === "sub-item") {
              return (
                <div
                  key={b.id}
                  className="ml-5 pl-2 border-l border-border/60 py-0.5 text-[11px] text-foreground/90 leading-relaxed flex items-start gap-1.5"
                >
                  <span className="font-serif italic font-bold text-primary shrink-0 text-[11px]">
                    {b.marker}
                  </span>
                  <div className="flex-1">
                    <LexiconInlineContent
                      content={b.title || b.rawText}
                      onNavigateReference={onNavigateReference}
                      onSelectStrong={onSelectStrong}
                    />
                  </div>
                </div>
              );
            }

            // Sub-lema o entrada derivada (ej: ἐάν)
            if (b.type === "sub-lemma") {
              return (
                <div
                  key={b.id}
                  className="my-2.5 rounded-lg border border-border bg-muted/30 p-2.5 space-y-1"
                >
                  <div className="flex items-center gap-2">
                    <Tag className="size-3 text-primary" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                      Sub-lema / Partícula relacionada
                    </span>
                  </div>
                  <div className="text-xs text-foreground font-medium">
                    <LexiconInlineContent
                      content={b.rawText}
                      onNavigateReference={onNavigateReference}
                      onSelectStrong={onSelectStrong}
                    />
                  </div>
                </div>
              );
            }

            // Nota de equivalencia en la Septuaginta (LXX)
            if (b.type === "lxx-note") {
              return (
                <div
                  key={b.id}
                  className="rounded-md border border-border/80 bg-muted/20 px-2.5 py-1.5 text-[11px] text-muted-foreground flex items-center gap-2 font-mono"
                >
                  <span className="font-bold text-primary text-[10px] bg-primary/10 px-1 py-0.2 rounded border border-primary/20">
                    LXX
                  </span>
                  <div className="flex-1 text-foreground font-sans text-xs">
                    <LexiconInlineContent
                      content={b.rawText.replace(/^\[|\]$/g, "")}
                      onNavigateReference={onNavigateReference}
                      onSelectStrong={onSelectStrong}
                    />
                  </div>
                </div>
              );
            }

            // Atribución de fuente académica (ej: (AS))
            if (b.type === "attribution") {
              return (
                <div key={b.id} className="pt-2 flex justify-end">
                  <span className="text-[10px] font-mono text-muted-foreground bg-muted/40 px-2 py-0.5 rounded border border-border/60">
                    Fuente: {b.marker === "AS" ? "Abbott-Smith Manual Greek Lexicon (AS)" : b.rawText}
                  </span>
                </div>
              );
            }

            // Párrafo estándar
            return (
              <div key={b.id} className="text-[11.5px] text-foreground leading-relaxed">
                <LexiconInlineContent
                  content={b.rawText}
                  onNavigateReference={onNavigateReference}
                  onSelectStrong={onSelectStrong}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
