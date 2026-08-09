"use client";

import { useState } from "react";
import { Library, PanelRight, Sparkles, Zap } from "lucide-react";
import { Sidebar, SidebarProvider, SidebarInset, SidebarTrigger } from "../components/ui/sidebar";
import { Button } from "../components/ui/button";
import { Omnibar } from "./Omnibar";
import { PanelCenterReader } from "./PanelCenterReader";
import { PanelLeftNavigation } from "./PanelLeftNavigation";
import { PanelRightAnalysis } from "./PanelRightAnalysis";
import { ThemeApplier } from "./ThemeApplier";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { DevotionModal } from "./devotion/DevotionModal";
import { DictionaryModal } from "./dictionary/DictionaryModal";
import { PassageGuideModal } from "./guide/PassageGuideModal";
import { useExegesisStore } from "../store/useExegesisStore";
import { cn } from "../lib/utils";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../components/ui/sheet";
import { useIsMobile } from "../hooks/use-mobile";

/**
 * Shell principal de Alethia Bridge.
 * Arquitectura de viewport sólida y sin conflictos:
 * - Sidebar izquierdo: Canon bíblico, módulos y ajustes de lectura
 * - Header superior: Logo único, Omnibar FTS5, toggles y tema
 * - Centro: Lector interlineal / paralelo multiversión con viewport estable
 * - Lateral derecho: Panel de análisis léxico y notas (Sheet modal en móvil, columna en desktop)
 */
export function AppShell() {
  const isMobile = useIsMobile();
  const [devotionOpen, setDevotionOpen] = useState(false);
  const [dictOpen, setDictOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const {
    isRightSidebarOpen,
    toggleRightSidebar,
    setRightSidebarOpen,
    activeLexiconTerm,
  } = useExegesisStore();

  return (
    <SidebarProvider defaultOpen={true}>
      <Sidebar collapsible="icon" className="border-r border-border bg-card/60">
        <PanelLeftNavigation />
      </Sidebar>

      <SidebarInset className="flex min-w-0 flex-1 flex-col overflow-hidden bg-background">
        {/* Cabecera Principal Unificada */}
        <header className="flex h-12 shrink-0 items-center justify-between gap-2.5 sm:gap-3 border-b border-border bg-card/80 px-3 sm:px-3.5 backdrop-blur-xs z-20">
          <div className="flex items-center gap-2">
            <SidebarTrigger title="Alternar menú de libros y módulos (Ctrl+B)" />
            <div className="flex items-center gap-1.5 font-bold tracking-tight text-sm select-none">
              <span className="text-foreground">Alethia</span>
              <span className="text-primary font-extrabold">Bridge</span>
              <span className="hidden sm:inline rounded-full bg-primary/10 px-1.5 py-0.2 text-[9px] font-mono font-semibold text-primary">
                v0.1 Pro
              </span>
            </div>
          </div>

          {/* Omnibar central con motor FTS5 */}
          <div className="flex items-center gap-2 flex-1 max-w-md justify-center">
            <Omnibar />
          </div>

          {/* Acciones del Top Bar */}
          <div className="flex items-center gap-1.5">
            {/* Botón Guía de Pasaje & Dossier Exegético */}
            <Button
              variant={guideOpen ? "secondary" : "ghost"}
              size="icon-sm"
              onClick={() => setGuideOpen(true)}
              title="Guía de Pasaje & Dossier Exegético (1 Clic)"
              className={cn(
                "relative size-8 transition-colors text-sky-500 hover:text-sky-600 dark:text-sky-400 hover:bg-sky-500/10",
                guideOpen && "bg-sky-500/15 border-sky-500/30",
              )}
            >
              <Zap className="size-4" />
            </Button>

            {/* Botón Diccionario Bíblico Enciclopédico */}
            <Button
              variant={dictOpen ? "secondary" : "ghost"}
              size="icon-sm"
              onClick={() => setDictOpen(true)}
              title="Diccionario Bíblico Enciclopédico (Easton)"
              className={cn(
                "relative size-8 transition-colors text-amber-500 hover:text-amber-600 dark:text-amber-400 hover:bg-amber-500/10",
                dictOpen && "bg-amber-500/15 border-amber-500/30",
              )}
            >
              <Library className="size-4" />
            </Button>

            {/* Botón Devocional Diario */}
            <Button
              variant={devotionOpen ? "secondary" : "ghost"}
              size="icon-sm"
              onClick={() => setDevotionOpen(true)}
              title="Devocional del Día (Lectura matutina y nocturna)"
              className={cn(
                "relative size-8 transition-colors text-rose-500 hover:text-rose-600 dark:text-rose-400 hover:bg-rose-500/10",
                devotionOpen && "bg-rose-500/15 border-rose-500/30",
              )}
            >
              <Sparkles className="size-4" />
            </Button>

            <Button
              variant={isRightSidebarOpen ? "secondary" : "ghost"}
              size="icon-sm"
              onClick={toggleRightSidebar}
              title={isRightSidebarOpen ? "Ocultar panel de análisis" : "Mostrar panel de análisis léxico y notas"}
              className={cn(
                "relative size-8 transition-colors",
                isRightSidebarOpen && "border-border/80 bg-accent text-foreground",
              )}
            >
              <PanelRight className="size-4" />
              {activeLexiconTerm && (
                <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-primary ring-2 ring-background animate-pulse" />
              )}
            </Button>

            <ThemeSwitcher />
          </div>
        </header>

        {/* Modal de Lectura Devocional Diaria */}
        <DevotionModal open={devotionOpen} onOpenChange={setDevotionOpen} />

        {/* Modal de Diccionario Bíblico Enciclopédico */}
        <DictionaryModal open={dictOpen} onOpenChange={setDictOpen} />

        {/* Modal de Guía de Pasaje & Dossier Exegético */}
        <PassageGuideModal open={guideOpen} onOpenChange={setGuideOpen} />

        {/* Área de trabajo: Lector central + Panel derecho integrado */}
        <div className="relative flex min-w-0 flex-1 overflow-hidden">
          <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-background">
            <PanelCenterReader />
          </main>

          {/* Panel derecho de análisis léxico y notas en DESKTOP (md+) */}
          {!isMobile && isRightSidebarOpen && (
            <aside className="hidden md:flex w-80 lg:w-96 shrink-0 flex-col overflow-hidden border-l border-border bg-card/40 animate-in slide-in-from-right-2 duration-150">
              <PanelRightAnalysis />
            </aside>
          )}
        </div>

        {/* Panel derecho de análisis léxico y notas en MÓVIL (<md) como Sheet offcanvas */}
        {isMobile && (
          <Sheet open={isRightSidebarOpen} onOpenChange={setRightSidebarOpen}>
            <SheetContent
              side="right"
              showCloseButton={false}
              className="w-[90vw] sm:max-w-md p-0 overflow-hidden bg-card text-card-foreground border-l border-border [&>button]:hidden focus:outline-none"
            >
              <SheetHeader className="sr-only">
                <SheetTitle>Análisis Léxico y Notas</SheetTitle>
                <SheetDescription>Panel de análisis exegético y cuaderno de notas</SheetDescription>
              </SheetHeader>
              <div className="flex h-full w-full flex-col overflow-hidden">
                <PanelRightAnalysis />
              </div>
            </SheetContent>
          </Sheet>
        )}
      </SidebarInset>

      <ThemeApplier />
    </SidebarProvider>
  );
}
