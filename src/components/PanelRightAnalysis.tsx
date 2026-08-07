"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bold,
  BookMarked,
  Check,
  Code,
  Copy,
  FileEdit,
  Italic,
  List,
  ListOrdered,
  MousePointerClick,
  Quote,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { SidebarContent, SidebarHeader, SidebarTrigger } from "../components/ui/sidebar";
import { Skeleton } from "../components/ui/skeleton";
import { useExegesisStore } from "../store/useExegesisStore";
import { addNote, deleteNote, notesForVerse } from "../lib/db/dexie-user-db";
import type { UserNote } from "../lib/db/dexie-user-db";
import type { LexiconEntry, MorphologyAnalysis } from "../types/bible";
import { cn } from "../lib/utils";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

export function PanelRightAnalysis() {
  const activeLexiconTerm = useExegesisStore((s) => s.activeLexiconTerm);
  const setActiveLexiconTerm = useExegesisStore((s) => s.setActiveLexiconTerm);
  const syncGroupA = useExegesisStore((s) => s.syncGroupA);
  const verseId = useMemo(
    () => `${syncGroupA.book} ${syncGroupA.chapter}:${syncGroupA.verse}`,
    [syncGroupA],
  );

  const [lexicon, setLexicon] = useState<LexiconEntry | null>(null);
  const [morph, setMorph] = useState<MorphologyAnalysis | null>(null);
  const [notes, setNotes] = useState<UserNote[]>([]);
  const [copiedLexicon, setCopiedLexicon] = useState(false);

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

  const refreshNotes = async () => {
    setNotes(await notesForVerse(verseId));
  };

  useEffect(() => {
    void refreshNotes();
  }, [verseId]);

  const editor = useEditor({
    extensions: [StarterKit],
    content: "",
    immediatelyRender: true,
    editorProps: {
      attributes: {
        class: "min-h-20 text-xs outline-none p-2 font-sans tiptap-content",
      },
    },
  });

  const saveNote = async () => {
    if (!editor) return;
    const html = editor.getHTML();
    if (html === "<p></p>" || html.trim() === "") return;
    await addNote({
      verse_id: verseId,
      content_html: html,
      tags: [],
      updated_at: new Date().toISOString(),
    });
    await refreshNotes();
    editor.commands.setContent("");
  };

  const handleDeleteNote = async (id?: number) => {
    if (!id) return;
    await deleteNote(id);
    await refreshNotes();
  };

  const copyLexiconInfo = async () => {
    if (!lexicon) return;
    const text = `${lexicon.strongId} — ${lexicon.lemma} (${lexicon.transliteration})\nGlosa: ${
      lexicon.glosa ?? "-"
    }\nDefinición: ${lexicon.shortDefinition}\n${lexicon.detailedDefinition ?? ""}`;
    await navigator.clipboard.writeText(text);
    setCopiedLexicon(true);
    setTimeout(() => setCopiedLexicon(false), 2000);
  };

  const isGreek = lexicon?.language === "GREEK";
  const isHebrew = lexicon?.language === "HEBREW";

  return (
    <>
      <SidebarHeader className="border-b border-border bg-card/60 p-2.5">
        <div className="flex h-7 items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-1.5">
            <BookMarked className="size-4 text-primary" />
            <span className="text-xs font-bold uppercase tracking-wider text-foreground">
              Análisis Léxico
            </span>
          </div>
          <div className="flex items-center gap-1">
            {activeLexiconTerm && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setActiveLexiconTerm(null)}
                title="Limpiar término"
                className="size-6 text-muted-foreground"
              >
                <X className="size-3.5" />
              </Button>
            )}
            <SidebarTrigger className="size-6" title="Ocultar análisis lateral" />
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="overflow-y-auto p-3 space-y-4 scrollbar-thin">
        {/* Entrada Léxica */}
        {activeLexiconTerm ? (
          lexicon ? (
            <div className="rounded-xl border border-border bg-card p-3.5 shadow-xs space-y-2.5 animate-in fade-in-0 duration-150">
              {/* Cabecera del Lema */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-xs font-bold text-primary">
                      {lexicon.strongId}
                    </span>
                    <Badge variant="outline" className="text-[10px] font-mono">
                      {lexicon.language}
                    </Badge>
                  </div>
                  <h2
                    className={cn(
                      "mt-1.5 text-2xl font-bold tracking-tight text-foreground",
                      isGreek ? "font-ancient-greek" : isHebrew ? "font-ancient-hebrew" : "",
                    )}
                  >
                    {lexicon.lemma}
                  </h2>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => void copyLexiconInfo()}
                  title="Copiar datos léxicos"
                  className="size-7 text-muted-foreground hover:text-foreground"
                >
                  {copiedLexicon ? <Check className="size-3.5 text-primary" /> : <Copy className="size-3.5" />}
                </Button>
              </div>

              {/* Transliteración y Pronunciación */}
              <div className="rounded-md bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">{lexicon.transliteration}</span>
                {lexicon.pronunciation ? ` · /${lexicon.pronunciation}/` : ""}
              </div>

              {/* Glosa de Traducción en Español */}
              {lexicon.glosa && (
                <div className="flex items-center gap-1.5 rounded-lg border border-primary/30 bg-accent/60 px-2.5 py-1.5 text-xs">
                  <Sparkles className="size-3.5 text-primary shrink-0" />
                  <span className="font-medium text-foreground">Glosa:</span>
                  <span className="font-bold text-primary">{lexicon.glosa}</span>
                </div>
              )}

              {/* Definición Breve */}
              <div className="space-y-1">
                <p className="text-xs font-medium text-foreground leading-relaxed">
                  {lexicon.shortDefinition}
                </p>
                {lexicon.detailedDefinition && (
                  <p className="text-[11px] text-muted-foreground leading-relaxed border-t border-border/40 pt-1.5">
                    {lexicon.detailedDefinition}
                  </p>
                )}
              </div>

              {/* Dominio Semántico */}
              {lexicon.semanticDomain && (
                <Badge variant="secondary" className="text-[10px]">
                  Dominio: {lexicon.semanticDomain}
                </Badge>
              )}

              {/* Desglose Morfológico */}
              {morph && (
                <div className="rounded-lg border border-border/80 bg-muted/20 p-2 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Morfología
                    </span>
                    <span className="font-mono text-[10px] font-semibold text-primary">{morph.code}</span>
                  </div>
                  <p className="text-[11px] text-foreground font-medium">{morph.description}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2 p-3 border border-border rounded-xl">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-8 w-1/2" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-16 w-full" />
            </div>
          )
        ) : (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border p-6 text-center">
            <MousePointerClick className="size-6 text-primary/60 mb-2" />
            <p className="text-xs font-semibold text-foreground">Explorador Léxico</p>
            <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
              Haz clic en cualquier palabra del texto bíblico para ver su lema original, Strong y análisis morfológico.
            </p>
          </div>
        )}

        {/* Editor de Notas TipTap del Versículo */}
        <div className="rounded-xl border border-border bg-card p-3 shadow-xs space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <FileEdit className="size-3.5 text-primary" />
              <span className="text-xs font-bold text-foreground">Notas de {verseId}</span>
            </div>
            <span className="font-mono text-[10px] text-muted-foreground">
              {notes.length} {notes.length === 1 ? "nota" : "notas"}
            </span>
          </div>

          {/* Barra de herramientas TipTap */}
          {editor && (
            <div className="flex flex-wrap items-center gap-0.5 rounded-lg border border-border bg-muted/40 p-1">
              <Button
                variant={editor.isActive("bold") ? "secondary" : "ghost"}
                size="icon-sm"
                onClick={() => editor.chain().focus().toggleBold().run()}
                title="Negrita"
                className="size-6"
              >
                <Bold className="size-3" />
              </Button>
              <Button
                variant={editor.isActive("italic") ? "secondary" : "ghost"}
                size="icon-sm"
                onClick={() => editor.chain().focus().toggleItalic().run()}
                title="Cursiva"
                className="size-6"
              >
                <Italic className="size-3" />
              </Button>
              <Button
                variant={editor.isActive("bulletList") ? "secondary" : "ghost"}
                size="icon-sm"
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                title="Lista con viñetas"
                className="size-6"
              >
                <List className="size-3" />
              </Button>
              <Button
                variant={editor.isActive("orderedList") ? "secondary" : "ghost"}
                size="icon-sm"
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                title="Lista numerada"
                className="size-6"
              >
                <ListOrdered className="size-3" />
              </Button>
              <Button
                variant={editor.isActive("blockquote") ? "secondary" : "ghost"}
                size="icon-sm"
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
                title="Cita"
                className="size-6"
              >
                <Quote className="size-3" />
              </Button>
              <Button
                variant={editor.isActive("code") ? "secondary" : "ghost"}
                size="icon-sm"
                onClick={() => editor.chain().focus().toggleCode().run()}
                title="Código"
                className="size-6"
              >
                <Code className="size-3" />
              </Button>
            </div>
          )}

          {/* Caja del Editor */}
          <div className="rounded-lg border border-border bg-background focus-within:border-primary transition-colors">
            <EditorContent editor={editor} />
          </div>

          <div className="flex justify-end">
            <Button size="sm" onClick={() => void saveNote()} className="h-7 px-3 text-xs font-semibold">
              Guardar Nota
            </Button>
          </div>

          {/* Lista de Notas Guardadas */}
          {notes.length > 0 && (
            <div className="mt-3 space-y-1.5 border-t border-border/60 pt-2.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                Historial de Estudio
              </span>
              {notes.map((n) => (
                <div
                  key={n.id}
                  className="group/note relative rounded-lg border border-border bg-background p-2.5 text-xs shadow-2xs hover:border-primary/40 transition-colors"
                >
                  <div
                    className="tiptap-content text-foreground leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: n.content_html }}
                  />
                  <div className="mt-2 flex items-center justify-between border-t border-border/30 pt-1 text-[10px] text-muted-foreground">
                    <span>{new Date(n.updated_at).toLocaleString("es-ES")}</span>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => void handleDeleteNote(n.id)}
                      className="size-5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      title="Eliminar nota"
                    >
                      <Trash2 className="size-2.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </SidebarContent>
    </>
  );
}
