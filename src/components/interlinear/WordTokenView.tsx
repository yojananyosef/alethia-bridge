"use client";

import { memo, useCallback } from "react";
import { useExegesisStore } from "../../store/useExegesisStore";
import type { WordToken } from "../../types/bible";

interface WordTokenViewProps {
  token: WordToken;
  isGreek?: boolean;
}

/**
 * Token interlineal memoizado. Cada token se suscribe solo a si su
 * alineacion_id coincide con hoveredAlignmentId (selector Zustand), por lo que
 * el hover resalta sin re-renderizar la página completa.
 */
export const WordTokenView = memo(function WordTokenView({
  token,
  isGreek,
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
    return <span className="text-[var(--muted)]">{token.text}</span>;
  }

  return (
    <span
      className={`inline-block cursor-default rounded px-0.5 transition-colors duration-75 ${
        hovered ? "bg-[var(--accent-soft)] ring-1 ring-[var(--accent)]" : ""
      }`}
      dir="ltr"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onClick={handleClick}
      title={token.strongId ? `${token.text} — ${token.strongId}` : token.text}
    >
      {token.text}
      {isGreek && token.strongId && (
        <span className="block text-center text-[10px] font-semibold leading-none text-[var(--accent)]">
          {token.strongId.replace(/^G/, "")}
        </span>
      )}
      {isGreek && token.morphCode && (
        <span className="block text-center text-[9px] leading-none text-[var(--muted)]">
          {token.morphCode.split("-").pop()}
        </span>
      )}
    </span>
  );
});
