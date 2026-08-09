"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  Heart,
  Loader2,
  Moon,
  RotateCcw,
  Sparkles,
  Sun,
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
import { useExegesisStore } from "../../store/useExegesisStore";
import type { DevotionEntry, DevotionMoment, DevotionResponse } from "../../types/devotion";
import { cn } from "../../lib/utils";

interface DevotionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MONTH_NAMES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

export function DevotionModal({ open, onOpenChange }: DevotionModalProps) {
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  const [moment, setMoment] = useState<DevotionMoment>(() => (new Date().getHours() >= 17 ? "noche" : "manana"));
  const [selectedModule, setSelectedModule] = useState<string>("");
  const [data, setData] = useState<DevotionResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const { setSyncGroupA } = useExegesisStore();

  const month = currentDate.getMonth() + 1;
  const day = currentDate.getDate();

  const loadDevotion = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        month: String(month),
        day: String(day),
        moment,
      });
      if (selectedModule) params.set("moduleId", selectedModule);

      const res = await fetch(`/api/devotion?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as DevotionResponse;
      setData(json);
      if (json.devotion && !selectedModule) {
        setSelectedModule(json.devotion.moduleId);
      }
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [month, day, moment, selectedModule]);

  useEffect(() => {
    if (open) {
      loadDevotion();
    }
  }, [open, loadDevotion]);

  const handlePrevDay = () => {
    setCurrentDate((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() - 1);
      return next;
    });
  };

  const handleNextDay = () => {
    setCurrentDate((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() + 1);
      return next;
    });
  };

  const handleToday = () => {
    const now = new Date();
    setCurrentDate(now);
    setMoment(now.getHours() >= 17 ? "noche" : "manana");
  };

  const handleJumpToScripture = (ref: { book: string; chapter: number; verse: number }) => {
    setSyncGroupA({ book: ref.book, chapter: ref.chapter, verse: ref.verse });
    onOpenChange(false);
  };

  const devotion = data?.devotion;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden border-border/80 bg-card/95 backdrop-blur-md shadow-2xl">
        {/* Header con gradiente sutil y controles de navegación */}
        <DialogHeader className="p-4 sm:p-5 border-b border-border/60 bg-muted/20 shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="size-8 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
                <Sparkles className="size-4" />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-bold tracking-tight">
                  Devocional Diario
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  {devotion?.moduleName || "Meditaciones y reflexiones bíblicas"}
                </DialogDescription>
              </div>
            </div>

            {/* Módulos devocionales selector */}
            {data?.availableModules && data.availableModules.length > 1 && (
              <select
                value={selectedModule}
                onChange={(e) => setSelectedModule(e.target.value)}
                className="text-xs rounded-md bg-background border border-border px-2 py-1 text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
              >
                {data.availableModules.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Barra de Controles: Fecha y Momento */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 mt-3 pt-3 border-t border-border/40">
            {/* Navegación por fechas */}
            <div className="flex items-center gap-1 bg-background/80 border border-border/80 rounded-lg p-0.5 shadow-2xs">
              <Button
                variant="ghost"
                size="icon"
                onClick={handlePrevDay}
                className="size-7 rounded-md"
                title="Día anterior"
              >
                <ChevronLeft className="size-3.5" />
              </Button>

              <div className="px-2.5 text-xs font-semibold tracking-wide flex items-center gap-1.5 select-none min-w-[120px] justify-center">
                <CalendarIcon className="size-3 text-muted-foreground" />
                <span>
                  {day} de {MONTH_NAMES[month - 1]}
                </span>
              </div>

              <Button
                variant="ghost"
                size="icon"
                onClick={handleNextDay}
                className="size-7 rounded-md"
                title="Día siguiente"
              >
                <ChevronRight className="size-3.5" />
              </Button>

              <Button
                variant="ghost"
                size="xs"
                onClick={handleToday}
                className="text-[11px] h-7 px-2 ml-0.5 font-medium text-muted-foreground hover:text-foreground"
                title="Ir a hoy"
              >
                Hoy
              </Button>
            </div>

            {/* Selector Matutino / Vespertino */}
            <div className="flex items-center bg-background/80 border border-border/80 rounded-lg p-0.5 shadow-2xs">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMoment("manana")}
                className={cn(
                  "h-7 px-2.5 text-xs font-medium rounded-md gap-1.5 transition-all",
                  moment === "manana"
                    ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 font-semibold shadow-2xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Sun className="size-3.5" />
                <span>Mañana</span>
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMoment("noche")}
                className={cn(
                  "h-7 px-2.5 text-xs font-medium rounded-md gap-1.5 transition-all",
                  moment === "noche"
                    ? "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 font-semibold shadow-2xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Moon className="size-3.5" />
                <span>Noche</span>
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Contenido Principal con Scroll */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2.5 text-muted-foreground">
              <Loader2 className="size-6 animate-spin text-primary" />
              <span className="text-xs">Cargando lectura devocional...</span>
            </div>
          ) : devotion ? (
            <>
              {/* Título de la Lectura */}
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] font-mono uppercase tracking-wider py-0 px-1.5 border-rose-500/30 text-rose-600 dark:text-rose-400 bg-rose-500/5">
                    {moment === "manana" ? "🌅 Lectura Matutina" : "🌙 Lectura Vespertina"}
                  </Badge>
                </div>
                <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground font-serif">
                  {devotion.title}
                </h3>
              </div>

              {/* Tarjeta del Pasaje Clave */}
              {devotion.keyVerse && (
                <div className="relative rounded-xl border border-primary/20 bg-primary/5 p-4 sm:p-4.5 space-y-3">
                  <p className="text-sm sm:text-base font-serif italic text-foreground leading-relaxed">
                    {devotion.keyVerse}
                  </p>

                  {devotion.parsedReference && (
                    <div className="flex items-center justify-end">
                      <Button
                        size="xs"
                        variant="secondary"
                        onClick={() => handleJumpToScripture(devotion.parsedReference!)}
                        className="text-xs font-semibold gap-1.5 bg-card hover:bg-card/80 border border-border shadow-2xs"
                      >
                        <BookOpen className="size-3.5 text-primary" />
                        <span>
                          Abrir {devotion.parsedReference.book} {devotion.parsedReference.chapter}:
                          {devotion.parsedReference.verse} en lector
                        </span>
                        <ExternalLink className="size-3 text-muted-foreground" />
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Texto de la Meditación Editorial */}
              <div className="prose prose-sm sm:prose-base dark:prose-invert max-w-none font-serif leading-relaxed text-foreground/90 space-y-4">
                {devotion.text.split("\n\n").map((paragraph, idx) => (
                  <p key={idx} className="text-sm sm:text-base leading-relaxed text-justify">
                    {paragraph.trim()}
                  </p>
                ))}
              </div>

              {/* Sección de Oración si existe */}
              {devotion.prayer && (
                <div className="rounded-xl border border-border/80 bg-muted/30 p-4 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                    <Heart className="size-3.5 text-rose-500" />
                    <span>Oración / Reflexión</span>
                  </div>
                  <p className="text-xs sm:text-sm font-serif italic text-muted-foreground leading-relaxed">
                    {devotion.prayer}
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
              <div className="size-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                <Sparkles className="size-6" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">No hay devocional disponible</p>
                <p className="text-xs text-muted-foreground max-w-xs">
                  Instala el módulo <strong>SPURGEON-ME</strong> desde la Biblioteca para disfrutar de las lecturas diarias de Charles Spurgeon.
                </p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
