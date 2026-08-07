"use client";

import { useEffect, useMemo, useState } from "react";
import { BookMarked } from "lucide-react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useExegesisStore } from "../store/useExegesisStore";
import { addNote, notesForVerse } from "../lib/db/dexie-user-db";
import type { UserNote } from "../lib/db/dexie-user-db";
import type { LexiconEntry, MorphologyAnalysis } from "../types/bible";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

export function PanelRightAnalysis() {
  const activeLexiconTerm = useExegesisStore((s) => s.activeLexiconTerm);
  const syncGroupA = useExegesisStore((s) => s.syncGroupA);
  const verseId = useMemo(
    () => `${syncGroupA.book} ${syncGroupA.chapter}:${syncGroupA.verse}`,
    [syncGroupA],
  );

  const [lexicon, setLexicon] = useState<LexiconEntry | null>(null);
  const [morph, setMorph] = useState<MorphologyAnalysis | null>(null);
  const [notes, setNotes] = useState<UserNote[]>([]);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled) {
        setLexicon(null);
        setMorph(null);
      }
    });
    if (!activeLexiconTerm) return;
    fetchJson<{ lexicon: LexiconEntry }>(
      `/api/bible/read?lexicon=${encodeURIComponent(activeLexiconTerm)}`,
    )
      .then((b) => {
        if (!cancelled) setLexicon(b.lexicon);
      })
      .catch(() => {
        if (!cancelled) setLexicon(null);
      });
    return () => {
      cancelled = true;
    };
  }, [activeLexiconTerm]);

  useEffect(() => {
    if (!lexicon) return;
    let cancelled = false;
    fetchJson<{ morph: MorphologyAnalysis }>(
      `/api/bible/read?morph=${encodeURIComponent(lexicon.strongId)}`,
    )
      .then((b) => {
        if (!cancelled) setMorph(b.morph);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [lexicon]);

  useEffect(() => {
    void notesForVerse(verseId).then(setNotes);
  }, [verseId]);

  const editor = useEditor({
    extensions: [StarterKit],
    content: "",
  });

  const saveNote = async () => {
    if (!editor) return;
    const html = editor.getHTML();
    if (html === "<p></p>") return;
    await addNote({
      verse_id: verseId,
      content_html: html,
      tags: [],
      updated_at: new Date().toISOString(),
    });
    setNotes(await notesForVerse(verseId));
    editor.commands.setContent("");
  };

  return (
    <aside className="flex h-full flex-col border-l border-[var(--border)] bg-[var(--panel)]">
      <div className="border-b border-[var(--border)] px-3 py-2 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
        Análisis
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {activeLexiconTerm ? (
          lexicon ? (
            <div className="rounded border border-[var(--border)] p-3">
              <div className="flex items-center gap-1 text-xs font-bold text-[var(--accent)]">
                <BookMarked className="h-3.5 w-3.5" />
                {lexicon.strongId} · {lexicon.lemma}
              </div>
              <div className="text-xs text-[var(--muted)]">
                {lexicon.transliteration}
                {lexicon.pronunciation ? ` · ${lexicon.pronunciation}` : ""}
              </div>
              <p className="mt-2 text-sm">{lexicon.shortDefinition}</p>
              {lexicon.detailedDefinition && (
                <p className="mt-2 text-xs text-[var(--muted)]">
                  {lexicon.detailedDefinition}
                </p>
              )}
              {lexicon.semanticDomain && (
                <div className="mt-2 inline-block rounded bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] text-[var(--accent)]">
                  {lexicon.semanticDomain}
                </div>
              )}
              {morph && (
                <div className="mt-3 border-t border-[var(--border)] pt-2 text-xs">
                  <span className="font-mono text-[10px] text-[var(--muted)]">
                    {morph.code}
                  </span>
                  <span className="ml-1">{morph.description}</span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-[var(--muted)]">Cargando léxico…</p>
          )
        ) : (
          <p className="text-xs text-[var(--muted)]">
            Haz clic en una palabra griega para ver su análisis
            léxico-morfológico.
          </p>
        )}

        <div className="mt-4">
          <div className="mb-1 text-xs font-semibold text-[var(--muted)]">
            Notas de {verseId}
          </div>
          <div className="rounded border border-[var(--border)] p-2">
            <EditorContent
              editor={editor}
              className="min-h-16 text-sm outline-none"
            />
            <button
              onClick={() => void saveNote()}
              className="mt-2 rounded bg-[var(--accent)] px-2 py-1 text-xs font-medium text-white"
            >
              Guardar nota
            </button>
          </div>
          {notes.length > 0 && (
            <ul className="mt-2 space-y-1">
              {notes.map((n) => (
                <li
                  key={n.id}
                  className="rounded border border-[var(--border)] bg-[var(--bg)] p-2 text-xs"
                >
                  <div dangerouslySetInnerHTML={{ __html: n.content_html }} />
                  <span className="mt-1 block text-[10px] text-[var(--muted)]">
                    {new Date(n.updated_at).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </aside>
  );
}
