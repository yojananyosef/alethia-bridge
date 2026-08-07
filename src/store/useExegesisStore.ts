"use client";

import { create } from "zustand";
import type { ReaderFontSize, ReaderLayout, SyncGroupReference, ThemeId } from "../types/bible";

interface ExegesisState {
  /** ID de alineación resaltado al hacer hover (resalte interlineal instantáneo). */
  hoveredAlignmentId: string | null;
  /** Término léxico seleccionado para el panel de análisis lateral (strong_id o lema). */
  activeLexiconTerm: string | null;
  /** Referencia actual del pasaje (Grupo de sincronización A). */
  syncGroupA: SyncGroupReference;
  /** Tema de lectura. */
  activeTheme: ThemeId;
  /** Módulos activos en el lector (orden = orden de visualización). */
  activeModules: string[];
  /** Layout del lector: "interleaved" (interlineal en línea) o "columns" (biblia paralela por columnas). */
  readerLayout: ReaderLayout;
  /** Tamaño de tipografía del lector bíblico. */
  fontSize: ReaderFontSize;
  /** Mostrar micro-etiquetas Strong en línea. */
  showStrongs: boolean;
  /** Mostrar códigos morfológicos en línea. */
  showMorphology: boolean;
  /** Color de resaltador activo ('#fde047', '#86efac', '#93c5fd', '#f472b6' o null). */
  activeHighlightColor: string | null;
  /** Estado de visibilidad del panel derecho de análisis. */
  isRightSidebarOpen: boolean;
}

interface ExegesisActions {
  setHoveredAlignment: (id: string | null) => void;
  setActiveLexiconTerm: (term: string | null) => void;
  setSyncGroupA: (ref: SyncGroupReference) => void;
  setActiveTheme: (theme: ThemeId) => void;
  toggleModule: (moduleId: string) => void;
  setReaderLayout: (layout: ReaderLayout) => void;
  setFontSize: (size: ReaderFontSize) => void;
  setShowStrongs: (show: boolean) => void;
  setShowMorphology: (show: boolean) => void;
  setActiveHighlightColor: (color: string | null) => void;
  setRightSidebarOpen: (open: boolean) => void;
  toggleRightSidebar: () => void;
}

export type ExegesisStore = ExegesisState & ExegesisActions;

export const useExegesisStore = create<ExegesisStore>()((set) => ({
  hoveredAlignmentId: null,
  activeLexiconTerm: null,
  syncGroupA: { book: "Gen", chapter: 1, verse: 1 },
  activeTheme: "academic-paper",
  activeModules: ["RV1909", "WLC"],
  readerLayout: "interleaved",
  fontSize: "base",
  showStrongs: true,
  showMorphology: true,
  activeHighlightColor: null,
  isRightSidebarOpen: true,

  setHoveredAlignment: (id) => set({ hoveredAlignmentId: id }),
  setActiveLexiconTerm: (term) => set({ activeLexiconTerm: term, isRightSidebarOpen: true }),
  setSyncGroupA: (ref) => set({ syncGroupA: ref }),
  setActiveTheme: (theme) => set({ activeTheme: theme }),
  setReaderLayout: (layout) => set({ readerLayout: layout }),
  setFontSize: (fontSize) => set({ fontSize }),
  setShowStrongs: (showStrongs) => set({ showStrongs }),
  setShowMorphology: (showMorphology) => set({ showMorphology }),
  setActiveHighlightColor: (color) => set({ activeHighlightColor: color }),
  setRightSidebarOpen: (isRightSidebarOpen) => set({ isRightSidebarOpen }),
  toggleRightSidebar: () => set((s) => ({ isRightSidebarOpen: !s.isRightSidebarOpen })),
  toggleModule: (moduleId) =>
    set((state) => {
      const has = state.activeModules.includes(moduleId);
      return {
        activeModules: has
          ? state.activeModules.filter((m) => m !== moduleId)
          : [...state.activeModules, moduleId],
      };
    }),
}));

