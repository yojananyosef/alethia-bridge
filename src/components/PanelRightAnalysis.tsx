"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bold,
  BookMarked,
  Check,
  Code,
  Compass,
  Copy,
  ExternalLink,
  FileEdit,
  Globe2,
  Italic,
  Layers,
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
import { SidebarContent, SidebarHeader } from "../components/ui/sidebar";
import { Skeleton } from "../components/ui/skeleton";
import { LibraryManagerModal } from "./catalog/LibraryManagerModal";
import { useExegesisStore } from "../store/useExegesisStore";
import { addNote, deleteNote, notesForVerse } from "../lib/db/dexie-user-db";
import type { UserNote } from "../lib/db/dexie-user-db";
import type { CommentaryModule, CrossRefModule, LexiconEntry, MorphologyAnalysis, ProperName } from "../types/bible";
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
  const setSyncGroupA = useExegesisStore((s) => s.setSyncGroupA);
  const verseId = useMemo(
    () => `${syncGroupA.book} ${syncGroupA.chapter}:${syncGroupA.verse}`,
    [syncGroupA],
  );

  const [lexicon, setLexicon] = useState<LexiconEntry | null>(null);
  const [morph, setMorph] = useState<MorphologyAnalysis | null>(null);
  const [nombres, setNombres] = useState<ProperName[]>([]);
  const [notes, setNotes] = useState<UserNote[]>([]);
  const [commentary, setCommentary] = useState<CommentaryModule[]>([]);
  const [crossRefs, setCrossRefs] = useState<CrossRefModule[]>([]);
  const [copiedLexicon, setCopiedLexicon] = useState(false);
  const [catalogModalOpen, setCatalogModalOpen] = useState(false);
  const [commentaryMode, setCommentaryMode] = useState<"verse" | "chapter">("verse");
  const [copiedNoteId, setCopiedNoteId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled) {
        setLexicon(null);
        setMorph(null);
        setNombres([]);
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
    fetchJson<{ nombres: ProperName[] }>(
      `/api/bible/read?name=${encodeURIComponent(activeLexiconTerm)}&book=${encodeURIComponent(
        syncGroupA.book,
      )}`,
    )
      .then((b) => {
        if (!cancelled) setNombres(b.nombres);
      })
      .catch(() => {
        if (!cancelled) setNombres([]);
      });
    return () => {
      cancelled = true;
    };
  }, [activeLexiconTerm, syncGroupA.book]);

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
    const ns = await notesForVerse(verseId);
    setNotes(ns);
  };

  useEffect(() => {
    let cancelled = false;
    void notesForVerse(verseId).then((ns) => {
      if (!cancelled) setNotes(ns);
    });
    return () => {
      cancelled = true;
    };
  }, [verseId]);

  // Comentario del capítulo (p. ej. Torres Amat): se filtra por versículo activo.
  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled) setCommentary([]);
    });
    fetchJson<{ commentary: CommentaryModule[] }>(
      `/api/bible/read?commentary=1&book=${encodeURIComponent(syncGroupA.book)}&chapter=${syncGroupA.chapter}`,
    )
      .then((b) => {
        if (!cancelled) setCommentary(b.commentary);
      })
      .catch(() => {
        if (!cancelled) setCommentary([]);
      });
    return () => {
      cancelled = true;
    };
  }, [syncGroupA.book, syncGroupA.chapter]);

  // Referencias cruzadas del versículo activo (módulos type=crossref, p. ej. TSK)
  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled) setCrossRefs([]);
    });
    fetchJson<{ crossref: CrossRefModule[] }>(
      `/api/bible/read?crossref=1&book=${encodeURIComponent(syncGroupA.book)}&chapter=${syncGroupA.chapter}&verse=${syncGroupA.verse}`,
    )
      .then((b) => {
        if (!cancelled) setCrossRefs(b.crossref ?? []);
      })
      .catch(() => {
        if (!cancelled) setCrossRefs([]);
      });
    return () => {
      cancelled = true;
    };
  }, [syncGroupA.book, syncGroupA.chapter, syncGroupA.verse]);

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

  // Al cambiar de versículo, vaciar el borrador del editor para no guardar
  // contenido en la referencia equivocada.
  useEffect(() => {
    if (editor && !editor.isDestroyed) {
      editor.commands.setContent("");
    }
  }, [verseId, editor]);

  const saveNote = async () => {
    if (!editor || editor.isDestroyed) return;
    const html = editor.getHTML();
    if (html === "<p></p>" || html.trim() === "") return;
    await addNote({
      verse_id: verseId,
      content_html: html,
      tags: [],
      updated_at: new Date().toISOString(),
    });
    await refreshNotes();
    if (!editor.isDestroyed) {
      editor.commands.setContent("");
    }
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
          {activeLexiconTerm && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setActiveLexiconTerm(null)}
              title="Limpiar término seleccionado"
              className="size-6 text-muted-foreground hover:text-foreground hover:bg-accent"
            >
              <X className="size-3.5" />
            </Button>
          )}
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

              {/* Nombre propio (TIPNR) */}
              {nombres.length > 0 && (
                <div className="space-y-2 rounded-lg border border-primary/40 bg-primary/5 p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                      Nombre propio
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {nombres.length > 1 ? `${nombres.length} referidos` : "TIPNR"}
                    </span>
                  </div>
                  {nombres.slice(0, 2).map((n, i) => (
                    <div key={i} className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-bold text-foreground">{n.nombre}</span>
                        <Badge variant="secondary" className="text-[9px] font-mono">
                          {n.tipo}
                        </Badge>
                      </div>
                      {n.descripcion && (
                        <p className="text-[11px] text-foreground leading-relaxed">{n.descripcion}</p>
                      )}
                      <div className="flex flex-wrap gap-1 text-[10px] text-muted-foreground">
                        {n.padres && <span>Padres: {n.padres}</span>}
                        {n.hermanos && <span>Hermanos: {n.hermanos}</span>}
                        {n.conyuges && <span>Cónyuges: {n.conyuges}</span>}
                        {n.hijos && <span>Hijos: {n.hijos}</span>}
                        {n.tribu && <span>Tribu: {n.tribu}</span>}
                      </div>
                      {n.geoLat !== null && n.geoLng !== null && (
                        <a
                          href={`https://www.google.com/maps/?q=${n.geoLat},${n.geoLng}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary underline underline-offset-2"
                        >
                          Ver en el mapa
                        </a>
                      )}
                    </div>
                  ))}
                  {nombres[0]?.referencias && (
                    <p className="text-[10px] text-muted-foreground leading-relaxed border-t border-primary/20 pt-1.5">
                      <span className="font-semibold">Refs: </span>
                      {nombres[0].referencias.slice(0, 220)}
                      {nombres[0].referencias.length > 220 ? "…" : ""}
                    </p>
                  )}
                </div>
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

        {/* Comentario bíblico (módulos type=commentary, p. ej. Torres Amat) */}
        {commentary.length > 0 ? (
          commentary.map((c) => {
            const activeNote = c.notes.find((n) => n.verse === syncGroupA.verse);
            const notesToRender = commentaryMode === "verse" ? (activeNote ? [activeNote] : []) : c.notes;

            return (
              <div key={c.moduleId} className="rounded-xl border border-border bg-card p-3 shadow-xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <BookMarked className="size-3.5 text-primary" />
                    <span className="text-xs font-bold text-foreground">{c.name}</span>
                  </div>

                  {/* Toggle entre versículo activo y capítulo completo */}
                  <div className="flex items-center gap-1 bg-muted/40 p-0.5 rounded text-[9px] font-mono">
                    <button
                      onClick={() => setCommentaryMode("verse")}
                      className={cn(
                        "px-1.5 py-0.5 rounded",
                        commentaryMode === "verse" ? "bg-card text-foreground font-bold shadow-2xs" : "text-muted-foreground",
                      )}
                    >
                      v. {syncGroupA.verse}
                    </button>
                    <button
                      onClick={() => setCommentaryMode("chapter")}
                      className={cn(
                        "px-1.5 py-0.5 rounded",
                        commentaryMode === "chapter" ? "bg-card text-foreground font-bold shadow-2xs" : "text-muted-foreground",
                      )}
                    >
                      Cap. ({c.notes.length})
                    </button>
                  </div>
                </div>

                {notesToRender.length > 0 ? (
                  <div className="space-y-3">
                    {notesToRender.map((note) => (
                      <div
                        key={note.verse}
                        className={cn(
                          "space-y-1.5 rounded-lg transition-colors",
                          commentaryMode === "chapter" && note.verse === syncGroupA.verse && "bg-primary/5 p-2 border border-primary/20",
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[10px] font-bold text-primary">
                            {syncGroupA.book} {syncGroupA.chapter}:{note.verse}
                          </span>
                          <button
                            onClick={async () => {
                              await navigator.clipboard.writeText(note.text);
                              setCopiedNoteId(`${c.moduleId}-${note.verse}`);
                              setTimeout(() => setCopiedNoteId(null), 2000);
                            }}
                            className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1"
                            title="Copiar nota del comentario"
                          >
                            {copiedNoteId === `${c.moduleId}-${note.verse}` ? (
                              <Check className="size-2.5 text-primary" />
                            ) : (
                              <Copy className="size-2.5" />
                            )}
                          </button>
                        </div>
                        {note.text.split(/\n\s*\n/).map((p, i) => (
                          <p key={i} className="text-[11px] leading-relaxed text-foreground">
                            {p}
                          </p>
                        ))}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    Sin nota de comentario para el versículo {syncGroupA.verse}.
                  </p>
                )}
              </div>
            );
          })
        ) : (
          <div className="rounded-xl border border-dashed border-border/80 bg-muted/10 p-3.5 space-y-2 text-center">
            <Layers className="size-5 text-primary/60 mx-auto" />
            <h4 className="text-xs font-bold text-foreground">Comentarios & Recursos Exegéticos</h4>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Instala comentarios versículo a versículo como Torres Amat (1825) desde el Catálogo Remoto.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCatalogModalOpen(true)}
              className="h-7 text-xs font-semibold text-primary border-primary/30 hover:bg-primary/10 gap-1.5"
            >
              <Globe2 className="size-3" />
              <span>Explorar Catálogo</span>
            </Button>
          </div>
        )}

        {/* Referencias Cruzadas Temáticas (módulos type=crossref, p. ej. TSK) */}
        {crossRefs.length > 0 ? (
          crossRefs.map((cr) => (
            <div key={cr.moduleId} className="rounded-xl border border-border bg-card p-3 shadow-xs space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Compass className="size-3.5 text-primary" />
                  <span className="text-xs font-bold text-foreground">{cr.name}</span>
                </div>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {syncGroupA.book} {syncGroupA.chapter}:{syncGroupA.verse}
                </span>
              </div>

              <div className="space-y-1.5">
                {cr.references.map((ref) => (
                  <button
                    key={ref.id}
                    onClick={() => {
                      setSyncGroupA({
                        book: ref.targetBook,
                        chapter: ref.targetChapter,
                        verse: ref.targetVerseStart,
                      });
                    }}
                    className="w-full group/ref text-left rounded-lg border border-border/60 bg-muted/20 hover:bg-accent/70 hover:border-primary/40 p-2 text-xs transition-all flex items-start justify-between gap-2"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-1.5 font-bold text-primary group-hover/ref:text-primary">
                        <span>{ref.targetReference}</span>
                        <ExternalLink className="size-2.5 opacity-60 group-hover/ref:opacity-100" />
                      </div>
                      {ref.note && (
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          {ref.note}
                        </p>
                      )}
                    </div>

                    <Badge variant="outline" className="text-[9px] font-mono shrink-0 border-border/80 text-muted-foreground">
                      {ref.votes}★
                    </Badge>
                  </button>
                ))}
              </div>
            </div>
          ))
        ) : null}

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
          {editor && !editor.isDestroyed && (
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

      <LibraryManagerModal
        open={catalogModalOpen}
        onOpenChange={setCatalogModalOpen}
      />
    </>
  );
}
