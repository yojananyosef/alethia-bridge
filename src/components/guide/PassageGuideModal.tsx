"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BookMarked,
  BookOpen,
  Check,
  Compass,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Layers,
  Library,
  Loader2,
  Printer,
  Quote,
  Share2,
  Sparkles,
  Zap,
} from "lucide-react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { useExegesisStore } from "../../store/useExegesisStore";
import {
  readChapter as readChapterClient,
  readCommentary as readCommentaryClient,
  readCrossReferences as readCrossReferencesClient,
  searchDictionary as searchDictionaryClient,
} from "../../lib/bible/client-service";
import type {
  CommentaryModule,
  CrossRefModule,
  InterlinearModule,
  ReadResponse,
  VersePayload,
} from "../../types/bible";
import type { DictionarySearchResult } from "../../types/dictionary";
import { CANON } from "../../lib/canon";
import { cn } from "../../lib/utils";

interface PassageGuideModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PassageGuideModal({ open, onOpenChange }: PassageGuideModalProps) {
  const { syncGroupA, installedModules } = useExegesisStore();
  const [loading, setLoading] = useState(false);
  const [readData, setReadData] = useState<ReadResponse | null>(null);
  const [commentaryData, setCommentaryData] = useState<CommentaryModule[]>([]);
  const [crossRefData, setCrossRefData] = useState<CrossRefModule[]>([]);
  const [dictArticles, setDictArticles] = useState<DictionarySearchResult[]>([]);
  const [copied, setCopied] = useState(false);

  const canonBook = CANON.find((b) => b.id === syncGroupA.book);
  const bookName = canonBook?.nombre ?? syncGroupA.book;
  const verseRef = `${bookName} ${syncGroupA.chapter}:${syncGroupA.verse ?? 1}`;

  const loadPassageGuide = useCallback(async () => {
    setLoading(true);

    try {
      const v = syncGroupA.verse ?? 1;
      const [rJson, cJson, xJson] = await Promise.all([
        readChapterClient(syncGroupA.book, String(syncGroupA.chapter), null),
        readCommentaryClient(syncGroupA.book, String(syncGroupA.chapter), installedModules),
        readCrossReferencesClient(syncGroupA.book, String(syncGroupA.chapter), String(v), installedModules),
      ]);

      setReadData(rJson);
      setCommentaryData(cJson.commentary ?? []);
      setCrossRefData(xJson.crossref ?? []);

      // Buscar artículos temáticos relevantes en el diccionario
      try {
        const dJson = await searchDictionaryClient(bookName);
        setDictArticles(dJson.results?.slice(0, 3) ?? []);
      } catch {}
    } catch {
      // Manejar error silenciosamente
    } finally {
      setLoading(false);
    }
  }, [syncGroupA, installedModules, bookName]);

  useEffect(() => {
    if (open) {
      void loadPassageGuide();
    }
  }, [open, loadPassageGuide]);

  // Generar reporte en formato Markdown académico
  const generateMarkdownReport = () => {
    const v = syncGroupA.verse ?? 1;
    const lines: string[] = [
      `# 📖 Dossier Exegético: ${verseRef}`,
      `*Generado con Alethia Bridge Pro*\n`,
      `## 1. Textos Bíblicos Paralelos`,
    ];

    for (const mod of readData?.modules ?? []) {
      const verse = mod.verses.find((item) => item.verse === v);
      if (verse) {
        lines.push(`**[${mod.moduleId}]** (${mod.language})`);
        lines.push(`> ${verse.text}\n`);
      }
    }

    // Palabras originales y Strong
    const originalMod = readData?.modules.find((m) => m.language === "el" || m.language === "he");
    const originalVerse = originalMod?.verses.find((item) => item.verse === v);
    if (originalVerse && originalVerse.tokens.length > 0) {
      lines.push(`## 2. Análisis del Texto Original (${originalMod?.moduleId})`);
      lines.push("| Pos | Palabra Original | Lema | Strong | Morfología |");
      lines.push("|---|---|---|---|---|");
      for (const t of originalVerse.tokens) {
        lines.push(
          `| ${t.position} | ${t.text} | ${t.lemma || "—"} | ${t.strongId || "—"} | ${t.morphCode || "—"} |`,
        );
      }
      lines.push("");
    }

    // Comentarios
    if (commentaryData.length > 0) {
      lines.push(`## 3. Comentarios Históricos y Exegéticos`);
      for (const c of commentaryData) {
        const note = c.notes.find((n) => n.verse === v);
        if (note) {
          lines.push(`### ${c.name}`);
          lines.push(`${note.text}\n`);
        }
      }
    }

    // Referencias cruzadas
    if (crossRefData.length > 0 && crossRefData[0]?.references?.length > 0) {
      lines.push(`## 4. Referencias Cruzadas (Treasury of Scripture Knowledge)`);
      for (const ref of crossRefData[0].references.slice(0, 10)) {
        lines.push(`* **${ref.targetReference}** (${ref.votes} votos)${ref.note ? `: ${ref.note}` : ""}`);
      }
      lines.push("");
    }

    return lines.join("\n");
  };

  const copyMarkdown = async () => {
    const md = generateMarkdownReport();
    await navigator.clipboard.writeText(md);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const v = syncGroupA.verse ?? 1;
  const activeVerses = readData?.modules
    .map((m) => ({
      module: m,
      verse: m.verses.find((item) => item.verse === v),
    }))
    .filter((x) => x.verse) ?? [];

  const originalMod = readData?.modules.find((m) => m.language === "el" || m.language === "he");
  const originalVerse = originalMod?.verses.find((item) => item.verse === v);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden border-border/80 bg-card/95 backdrop-blur-md shadow-2xl">
        {/* Header con acciones */}
        <DialogHeader className="p-4 sm:p-5 border-b border-border/60 bg-muted/20 shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="size-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                <Zap className="size-4" />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-bold tracking-tight">
                  Guía de Pasaje & Dossier Exegético
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Síntesis teológica, filológica y pastoral de <strong className="text-foreground">{verseRef}</strong>
                </DialogDescription>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={copyMarkdown}
                className="gap-1.5 text-xs font-semibold shadow-2xs"
                title="Copiar estudio completo en formato Markdown"
              >
                {copied ? <Check className="size-3.5 text-primary" /> : <Copy className="size-3.5" />}
                <span>{copied ? "Dossier Copiado" : "Copiar para Estudio"}</span>
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Contenido del Dossier con Scroll */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-7 bg-background/50 scrollbar-thin">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-2.5 text-muted-foreground">
              <Loader2 className="size-7 animate-spin text-primary" />
              <span className="text-xs font-medium">Sintetizando recursos exegéticos para {verseRef}...</span>
            </div>
          ) : (
            <>
              {/* Sección 1: Textos Bíblicos Paralelos */}
              <section className="space-y-3">
                <div className="flex items-center gap-2 border-b border-border/50 pb-2">
                  <BookOpen className="size-4 text-primary" />
                  <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
                    1. Textos Bíblicos Paralelos
                  </h3>
                </div>

                <div className="grid grid-cols-1 gap-2.5">
                  {activeVerses.map(({ module, verse }) => (
                    <div
                      key={module.moduleId}
                      className="p-3.5 rounded-xl border border-border/80 bg-card shadow-2xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-primary">{module.moduleId}</span>
                        <Badge variant="outline" className="text-[9px] font-mono uppercase">
                          {module.language}
                        </Badge>
                      </div>
                      <p
                        dir={module.language === "he" ? "rtl" : "ltr"}
                        className={cn(
                          "text-sm font-serif leading-relaxed text-foreground",
                          module.language === "he" && "text-base font-hebrew",
                          module.language === "el" && "font-greek",
                        )}
                      >
                        {verse?.text}
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              {/* Sección 2: Desglose Filológico y Palabras Clave */}
              {originalVerse && originalVerse.tokens.length > 0 && (
                <section className="space-y-3">
                  <div className="flex items-center gap-2 border-b border-border/50 pb-2">
                    <Compass className="size-4 text-primary" />
                    <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
                      2. Vocabulario Clave & Lengua Original ({originalMod?.moduleId})
                    </h3>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {originalVerse.tokens.map((t) => (
                      <div
                        key={t.id}
                        className="p-2.5 rounded-lg border border-border/70 bg-card/60 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-foreground font-serif text-sm">
                            {t.text}
                          </span>
                          {t.strongId && (
                            <span className="font-mono text-[9px] text-primary font-semibold">
                              {t.strongId}
                            </span>
                          )}
                        </div>
                        {t.lemma && (
                          <div className="text-[11px] text-muted-foreground">
                            Lema: <span className="font-medium text-foreground">{t.lemma}</span>
                          </div>
                        )}
                        {t.morphCode && (
                          <Badge variant="secondary" className="text-[9px] font-mono py-0 px-1">
                            {t.morphCode}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Sección 3: Comentarios de la Reforma e Historia */}
              <section className="space-y-3">
                <div className="flex items-center gap-2 border-b border-border/50 pb-2">
                  <BookMarked className="size-4 text-primary" />
                  <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
                    3. Exposición & Comentarios Teológicos
                  </h3>
                </div>

                {commentaryData.filter((c) => c.notes.some((n) => n.verse === v)).length > 0 ? (
                  <div className="space-y-3">
                    {commentaryData
                      .filter((c) => c.notes.some((n) => n.verse === v))
                      .map((c) => {
                        const note = c.notes.find((n) => n.verse === v);
                        if (!note) return null;
                        return (
                          <div
                            key={c.moduleId}
                            className="p-4 rounded-xl border border-border/80 bg-card shadow-2xs space-y-2"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-foreground">{c.name}</span>
                              <Badge variant="outline" className="text-[9px] font-mono">
                                {c.moduleId}
                              </Badge>
                            </div>
                            <div className="prose prose-xs dark:prose-invert max-w-none text-muted-foreground leading-relaxed font-serif text-xs sm:text-sm">
                              {note.text.split("\n\n").map((para, i) => (
                                <p key={i}>{para.trim()}</p>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl border border-dashed border-border text-center text-xs text-muted-foreground">
                    No hay notas de comentarios instalados para este versículo específico. Instala Matthew Henry, Calvino, Lutero o Wesley desde la Biblioteca.
                  </div>
                )}
              </section>

              {/* Sección 4: Referencias Cruzadas (TSK) */}
              {crossRefData.length > 0 && crossRefData[0]?.references?.length > 0 && (
                <section className="space-y-3">
                  <div className="flex items-center gap-2 border-b border-border/50 pb-2">
                    <Layers className="size-4 text-primary" />
                    <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
                      4. Referencias Cruzadas (Treasury of Scripture Knowledge)
                    </h3>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {crossRefData[0].references.slice(0, 12).map((ref) => (
                      <Badge
                        key={ref.id}
                        variant="secondary"
                        className="text-xs font-mono py-1 px-2.5 gap-1.5"
                      >
                        <span className="font-bold text-foreground">{ref.targetReference}</span>
                        {ref.votes > 1 && (
                          <span className="text-[10px] text-primary font-bold">★ {ref.votes}</span>
                        )}
                      </Badge>
                    ))}
                  </div>
                </section>
              )}

              {/* Sección 5: Tópicos y Artículos de Diccionario */}
              {dictArticles.length > 0 && (
                <section className="space-y-3">
                  <div className="flex items-center gap-2 border-b border-border/50 pb-2">
                    <Library className="size-4 text-amber-500" />
                    <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
                      5. Contexto & Diccionario Bíblico (Easton)
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {dictArticles.map((art) => (
                      <div
                        key={art.id}
                        className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/5 text-xs space-y-1"
                      >
                        <span className="font-bold text-foreground text-xs">{art.term}</span>
                        <p
                          className="text-[11px] text-muted-foreground line-clamp-2 leading-snug"
                          dangerouslySetInnerHTML={{ __html: art.snippet }}
                        />
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
