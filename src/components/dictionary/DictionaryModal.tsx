"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BookOpen,
  Check,
  Compass,
  Copy,
  ExternalLink,
  Library,
  Loader2,
  Search,
  Sparkles,
  X,
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
import { Input } from "../ui/input";
import { useExegesisStore } from "../../store/useExegesisStore";
import {
  getDictionaryEntry as getDictionaryEntryClient,
  searchDictionary as searchDictionaryClient,
} from "../../lib/bible/client-service";
import type {
  DictionaryEntry,
  DictionarySearchResponse,
  DictionarySearchResult,
} from "../../types/dictionary";
import { parseScriptureReference } from "../../lib/bible/reference-parser";
import { cn } from "../../lib/utils";

interface DictionaryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTerm?: string | null;
}

export function DictionaryModal({ open, onOpenChange, initialTerm }: DictionaryModalProps) {
  const [query, setQuery] = useState("");
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<DictionarySearchResult[]>([]);
  const [activeEntry, setActiveEntry] = useState<DictionaryEntry | null>(null);
  const [availableDicts, setAvailableDicts] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedModule, setSelectedModule] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const { setSyncGroupA } = useExegesisStore();

  // Búsqueda de términos
  const runSearch = useCallback(async (q: string, modId?: string) => {
    setLoading(true);
    try {
      const data = await searchDictionaryClient(q, modId || null);
      setSearchResults(data.results);
      setAvailableDicts(data.availableDictionaries);
      if (data.results.length > 0 && !selectedSlug) {
        setSelectedSlug(data.results[0].slug);
      }
    } catch {
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  }, [selectedSlug]);

  // Carga de artículo individual
  const loadEntry = useCallback(async (slug: string, modId?: string) => {
    try {
      const entry = await getDictionaryEntryClient(slug, modId || null);
      setActiveEntry(entry);
    } catch {
      setActiveEntry(null);
    }
  }, []);

  useEffect(() => {
    if (open) {
      const initial = initialTerm || query;
      runSearch(initial, selectedModule);
      if (initialTerm) {
        setQuery(initialTerm);
        loadEntry(initialTerm, selectedModule);
      }
    }
  }, [open, initialTerm, selectedModule]);

  useEffect(() => {
    if (selectedSlug) {
      loadEntry(selectedSlug, selectedModule);
    }
  }, [selectedSlug, selectedModule, loadEntry]);

  const handleJumpToScripture = (rawRef: string) => {
    const parsed = parseScriptureReference(rawRef);
    if (parsed) {
      setSyncGroupA({ book: parsed.book, chapter: parsed.chapter, verse: parsed.verse });
      onOpenChange(false);
    }
  };

  const copyEntry = async () => {
    if (!activeEntry) return;
    const text = `${activeEntry.term.toUpperCase()}\n\n${activeEntry.definition}\n\n[Fuente: ${activeEntry.moduleName}]`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0 gap-0 overflow-hidden border-border/80 bg-card/95 backdrop-blur-md shadow-2xl">
        {/* Header con Buscador FTS5 y Selector de Diccionario */}
        <DialogHeader className="p-4 border-b border-border/60 bg-muted/20 shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="size-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                <Library className="size-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold tracking-tight">
                  Diccionario Bíblico Enciclopédico
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  {activeEntry?.moduleName || "Artículos de teología, geografía, biografía y costumbres bíblicas"}
                </DialogDescription>
              </div>
            </div>

            {availableDicts.length > 1 && (
              <select
                value={selectedModule}
                onChange={(e) => {
                  setSelectedModule(e.target.value);
                  runSearch(query, e.target.value);
                }}
                className="text-xs rounded-md bg-background border border-border px-2 py-1 text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
              >
                {availableDicts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Barra de búsqueda de artículos */}
          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => {
                const val = e.target.value;
                setQuery(val);
                runSearch(val, selectedModule);
              }}
              placeholder="Buscar término bíblico (ej: Jerusalem, Covenant, Tabernacle, Aaron)..."
              className="pl-9 bg-background/80 border-border/80 h-9 text-xs sm:text-sm"
              autoFocus
            />
          </div>
        </DialogHeader>

        {/* Cuerpo Master-Detail */}
        <div className="flex-1 flex overflow-hidden">
          {/* Lista de resultados (Columna Izquierda) */}
          <div className="w-64 sm:w-80 border-r border-border/60 flex flex-col bg-muted/10 shrink-0 overflow-y-auto p-2 space-y-1 scrollbar-thin">
            {loading && searchResults.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
                <Loader2 className="size-5 animate-spin text-primary" />
                <span className="text-xs">Buscando artículos...</span>
              </div>
            ) : searchResults.length > 0 ? (
              searchResults.map((item) => {
                const isSelected = selectedSlug === item.slug;
                return (
                  <button
                    key={item.id}
                    onClick={() => setSelectedSlug(item.slug)}
                    className={cn(
                      "w-full text-left p-2.5 rounded-lg text-xs transition-colors space-y-1 border",
                      isSelected
                        ? "bg-primary/10 border-primary/30 text-foreground font-semibold shadow-2xs"
                        : "bg-card/40 border-transparent text-muted-foreground hover:bg-card hover:text-foreground",
                    )}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className={cn("text-xs font-bold", isSelected ? "text-primary" : "text-foreground")}>
                        {item.term}
                      </span>
                      {item.source && (
                        <span className="text-[9px] font-mono text-muted-foreground opacity-75">
                          {item.source}
                        </span>
                      )}
                    </div>
                    <p
                      className="text-[11px] line-clamp-2 text-muted-foreground leading-snug"
                      dangerouslySetInnerHTML={{ __html: item.snippet }}
                    />
                  </button>
                );
              })
            ) : (
              <div className="py-12 text-center text-xs text-muted-foreground px-4">
                No se encontraron artículos para &quot;{query}&quot;.
              </div>
            )}
          </div>

          {/* Lector del Artículo Seleccionado (Columna Derecha) */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-5 bg-card">
            {activeEntry ? (
              <>
                {/* Título del Artículo y Acciones */}
                <div className="flex items-start justify-between gap-4 border-b border-border/50 pb-4">
                  <div>
                    <Badge variant="outline" className="text-[10px] font-mono uppercase tracking-wider mb-1.5 border-primary/30 text-primary">
                      {activeEntry.source || "Diccionario Bíblico"}
                    </Badge>
                    <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground font-serif">
                      {activeEntry.term}
                    </h2>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={copyEntry}
                    className="gap-1.5 text-xs shrink-0"
                    title="Copiar artículo completo"
                  >
                    {copied ? <Check className="size-3.5 text-primary" /> : <Copy className="size-3.5" />}
                    <span>{copied ? "Copiado" : "Copiar"}</span>
                  </Button>
                </div>

                {/* Referencias Bíblicas Relacionadas */}
                {activeEntry.references && (
                  <div className="flex flex-wrap items-center gap-1.5 p-3 rounded-lg bg-muted/30 border border-border/60">
                    <span className="text-xs font-bold text-muted-foreground mr-1">
                      Pasajes clave:
                    </span>
                    {activeEntry.references.split(";").map((ref, idx) => {
                      const cleanRef = ref.trim();
                      if (!cleanRef) return null;
                      return (
                        <button
                          key={idx}
                          onClick={() => handleJumpToScripture(cleanRef)}
                          className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md bg-background border border-border hover:border-primary text-primary hover:text-primary-foreground hover:bg-primary transition-colors"
                          title={`Abrir ${cleanRef} en el lector`}
                        >
                          <BookOpen className="size-2.5" />
                          <span>{cleanRef}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Texto de la Definición Enciclopédica */}
                <div className="prose prose-sm sm:prose-base dark:prose-invert max-w-none font-serif leading-relaxed text-foreground/90 space-y-4">
                  {activeEntry.definition.split("\n\n").map((para, i) => (
                    <p key={i} className="text-sm sm:text-base leading-relaxed text-justify">
                      {para.trim()}
                    </p>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
                <Library className="size-10 text-muted-foreground/40" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">Selecciona un artículo</p>
                  <p className="text-xs text-muted-foreground max-w-xs">
                    Explora los miles de términos enciclopédicos del diccionario bíblico.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
