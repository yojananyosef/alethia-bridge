"use client";

import { memo, useCallback } from "react";
import { useExegesisStore } from "../../store/useExegesisStore";
import type { WordToken } from "../../types/bible";

interface WordTokenViewProps {
  token: WordToken;
  /** Muestra el micro-label inferior (número Strong + abreviatura morfológica). */
  withLabels?: boolean;
  /** Dirección de escritura del módulo (hebreo → rtl). */
  dir?: "ltr" | "rtl";
}

/**
 * Token interlineal memoizado. Cada token se suscribe solo a si su
 * alineacion_id coincide con hoveredAlignmentId (selector Zustand), por lo que
 * el hover resalta sin re-renderizar la página completa.
 */
export const WordTokenView = memo(function WordTokenView({
  token,
  withLabels,
  dir = "ltr",
}: WordTokenViewProps) {
  const hovered = useExegesisStore((s) => s.hoveredAlignmentId === token.alignmentId);
  const showStrongs = useExegesisStore((s) => s.showStrongs);
  const showMorphology = useExegesisStore((s) => s.showMorphology);
  const setHovered = useExegesisStore((s) => s.setHoveredAlignment);
  const setLexiconTerm = useExegesisStore((s) => s.setActiveLexiconTerm);

  const handleEnter = useCallback(
    () => setHovered(token.alignmentId),
    [setHovered, token.alignmentId],
  );
  const handleLeave = useCallback(() => setHovered(null), [setHovered]);
  const handleClick = useCallback(() => {
    if (token.strongId) {
      setLexiconTerm(token.strongId);
    }
  }, [token.strongId, setLexiconTerm]);

  if (/^[^\p{L}\p{M}]$/u.test(token.text)) {
    return <span className="text-muted-foreground">{token.text}</span>;
  }

  const isGreek = /[\u0370-\u03FF\u1F00-\u1FFF]/.test(token.text);
  const isHebrew = /[\u0590-\u05FF]/.test(token.text);

  return (
    <span
      className={`inline-flex flex-col items-center justify-start align-top rounded-md px-1 py-0.5 transition-all duration-150 cursor-pointer select-text ${
        hovered
          ? "bg-amber-500/15 text-primary ring-1 ring-primary/40 shadow-xs scale-102"
          : "hover:bg-accent/70"
      }`}
      dir={dir}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onClick={handleClick}
      title={
        token.strongId
          ? `${token.text} (${token.strongId}${token.lemma ? ` — ${token.lemma}` : ""}${
              token.morphCode ? ` · ${token.morphCode}` : ""
            })`
          : token.text
      }
    >
      <span
        className={`leading-tight font-medium ${
          isGreek ? "font-ancient-greek text-[1.05em]" : isHebrew ? "font-ancient-hebrew text-[1.15em]" : ""
        }`}
      >
        {token.text}
      </span>
      {withLabels && showStrongs && token.strongId && (
        <span className="block mt-0.5 text-center text-[10px] font-mono font-semibold tracking-tighter text-primary opacity-90 leading-none">
          {token.strongId.replace(/^[GH]/, "")}
        </span>
      )}
      {withLabels && showMorphology && token.morphCode && (
        <span className="block mt-0.5 text-center text-[9px] font-sans text-muted-foreground/80 leading-none">
          {token.morphCode.split("-").pop()}
        </span>
      )}
    </span>
  );
});

