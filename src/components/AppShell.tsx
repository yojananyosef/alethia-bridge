"use client";

import { Sidebar, SidebarProvider, SidebarInset, SidebarTrigger } from "../components/ui/sidebar";
import { Omnibar } from "./Omnibar";
import { PanelCenterReader } from "./PanelCenterReader";
import { PanelLeftNavigation } from "./PanelLeftNavigation";
import { PanelRightAnalysis } from "./PanelRightAnalysis";
import { ThemeApplier } from "./ThemeApplier";
import { ThemeSwitcher } from "./ThemeSwitcher";

/**
 * Shell de la aplicación (patrón dashboard shadcn): sidebar izquierda
 * (biblias y módulos), cabecera con omnibar y tema, lector central y
 * sidebar derecha de análisis.
 */
export function AppShell() {
  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <PanelLeftNavigation />
      </Sidebar>
      <SidebarInset className="overflow-hidden">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-card px-3">
          <SidebarTrigger />
          <div className="text-sm font-bold tracking-tight">
            Alethia<span className="text-primary">Bridge</span>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <Omnibar />
            <ThemeSwitcher />
          </div>
        </header>
        <SidebarProvider className="flex-1" disableKeyboardShortcut>
          <main className="flex min-w-0 flex-1 flex-col">
            <PanelCenterReader />
          </main>
          <Sidebar side="right" collapsible="offcanvas">
            <PanelRightAnalysis />
          </Sidebar>
        </SidebarProvider>
      </SidebarInset>
      <ThemeApplier />
    </SidebarProvider>
  );
}
