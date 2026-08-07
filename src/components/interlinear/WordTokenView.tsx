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
  const setHovered = useExegesisStore((s) => s.setHoveredAlignment);
  const setLexiconTerm = useExegesisStore((s) => s.setActiveLexiconTerm);

  const handleEnter = useCallback(
    () => setHovered(token.alignmentId),
    [setHovered, token.alignmentId],
  );
  const handleLeave = useCallback(() => setHovered(null), [setHovered]);
  const handleClick = useCallback(() => {
    if (token.strongId) setLexiconTerm(token.strongId);
  }, [token.strongId, setLexiconTerm]);

  if (/^[^\p{L}\p{M}]$/u.test(token.text)) {
    return <span className="text-muted-foreground">{token.text}</span>;
  }

  return (
    <span
      className={`inline-block cursor-default rounded px-0.5 transition-colors duration-75 ${
        hovered ? "bg-accent ring-1 ring-primary" : ""
      }`}
      dir={dir}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onClick={handleClick}
      title={token.strongId ? `${token.text} — ${token.strongId}` : token.text}
    >
      {token.text}
      {withLabels && token.strongId && (
        <span className="block text-center text-[10px] font-semibold leading-none text-primary">
          {token.strongId.replace(/^[GH]/, "")}
        </span>
      )}
      {withLabels && token.morphCode && (
        <span className="block text-center text-[9px] leading-none text-muted-foreground">
          {token.morphCode.split("-").pop()}
        </span>
      )}
    </span>
  );
});
