"use client";

import { useEffect, useMemo, useState } from "react";
import { BookMarked, MousePointerClick } from "lucide-react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Skeleton } from "../components/ui/skeleton";
import { PanelHeader } from "./PanelHeader";
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
    <aside className="flex h-full flex-col border-l border-border bg-card">
      <PanelHeader>Análisis</PanelHeader>
      <div className="flex-1 overflow-y-auto p-3">
        {activeLexiconTerm ? (
          lexicon ? (
            <div className="rounded border border-border p-3">
              <div className="flex items-center gap-1 text-xs font-bold text-primary">
                <BookMarked className="h-3.5 w-3.5" />
                {lexicon.strongId} · {lexicon.lemma}
              </div>
              <div className="text-xs text-muted-foreground">
                {lexicon.transliteration}
                {lexicon.pronunciation ? ` · ${lexicon.pronunciation}` : ""}
              </div>
              <p className="mt-2 text-sm">{lexicon.shortDefinition}</p>
              {lexicon.detailedDefinition && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {lexicon.detailedDefinition}
                </p>
              )}
              {lexicon.semanticDomain && (
                <Badge
                  variant="outline"
                  className="mt-2 border-transparent bg-accent text-primary"
                >
                  {lexicon.semanticDomain}
                </Badge>
              )}
              {morph && (
                <div className="mt-3 border-t border-border pt-2 text-xs">
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {morph.code}
                  </span>
                  <span className="ml-1">{morph.description}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          )
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-1.5 text-center">
            <MousePointerClick className="h-4 w-4 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              Haz clic en una palabra griega para ver su análisis
              léxico-morfológico.
            </p>
          </div>
        )}

        <div className="mt-4">
          <div className="mb-1 text-xs font-semibold text-muted-foreground">
            Notas de {verseId}
          </div>
          <div className="rounded border border-border p-2">
            <EditorContent
              editor={editor}
              className="min-h-16 text-sm outline-none"
            />
            <Button size="sm" onClick={() => void saveNote()} className="mt-2">
              Guardar nota
            </Button>
          </div>
          {notes.length > 0 && (
            <ul className="mt-2 space-y-1">
              {notes.map((n) => (
                <li
                  key={n.id}
                  className="rounded border border-border bg-background p-2 text-xs"
                >
                  <div dangerouslySetInnerHTML={{ __html: n.content_html }} />
                  <span className="mt-1 block text-[10px] text-muted-foreground">
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
