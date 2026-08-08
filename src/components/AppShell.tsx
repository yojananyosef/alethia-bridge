"use client";

import { PanelRight } from "lucide-react";
import { Sidebar, SidebarProvider, SidebarInset, SidebarTrigger } from "../components/ui/sidebar";
import { Button } from "../components/ui/button";
import { Omnibar } from "./Omnibar";
import { PanelCenterReader } from "./PanelCenterReader";
import { PanelLeftNavigation } from "./PanelLeftNavigation";
import { PanelRightAnalysis } from "./PanelRightAnalysis";
import { ThemeApplier } from "./ThemeApplier";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { useExegesisStore } from "../store/useExegesisStore";
import { cn } from "../lib/utils";

/**
 * Shell principal de Alethia Bridge.
 * Arquitectura de viewport sólida y sin conflictos de doble SidebarProvider:
 * - Sidebar izquierdo: Canon bíblico y módulos instalados
 * - Header superior: Logo único, Omnibar FTS5, toggles y tema
 * - Centro: Lector interlineal / paralelo multiversión
 * - Lateral derecho: Panel de análisis léxico y notas TipTap con toggle fluido
 */
export function AppShell() {
  const { isRightSidebarOpen, toggleRightSidebar, activeLexiconTerm } = useExegesisStore();

  return (
    <SidebarProvider defaultOpen={true}>
      <Sidebar collapsible="icon" className="border-r border-border bg-card/60">
        <PanelLeftNavigation />
      </Sidebar>

      <SidebarInset className="flex min-w-0 flex-1 flex-col overflow-hidden bg-background">
        {/* Cabecera Principal Unificada */}
        <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-border bg-card/80 px-3.5 backdrop-blur-xs z-20">
          <div className="flex items-center gap-2.5">
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

        {/* Área de trabajo: Lector central + Panel derecho integrado */}
        <div className="flex min-w-0 flex-1 overflow-hidden">
          <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-background">
            <PanelCenterReader />
          </main>

          {/* Panel derecho de análisis léxico y notas TipTap */}
          {isRightSidebarOpen && (
            <aside className="w-80 md:w-96 shrink-0 border-l border-border bg-card/40 flex flex-col overflow-hidden animate-in slide-in-from-right-4 duration-200">
              <PanelRightAnalysis />
            </aside>
          )}
        </div>
      </SidebarInset>

      <ThemeApplier />
    </SidebarProvider>
  );
}
