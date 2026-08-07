"use client";

import { create } from "zustand";
import type { SyncGroupReference, ThemeId } from "../types/bible";

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
}

interface ExegesisActions {
  setHoveredAlignment: (id: string | null) => void;
  setActiveLexiconTerm: (term: string | null) => void;
  setSyncGroupA: (ref: SyncGroupReference) => void;
  setActiveTheme: (theme: ThemeId) => void;
  toggleModule: (moduleId: string) => void;
}

export type ExegesisStore = ExegesisState & ExegesisActions;

export const useExegesisStore = create<ExegesisStore>()((set) => ({
  hoveredAlignmentId: null,
  activeLexiconTerm: null,
  syncGroupA: { book: "Jn", chapter: 3, verse: 16 },
  activeTheme: "academic-paper",
  activeModules: ["RV1909", "NA28"],
  setHoveredAlignment: (id) => set({ hoveredAlignmentId: id }),
  setActiveLexiconTerm: (term) => set({ activeLexiconTerm: term }),
  setSyncGroupA: (ref) => set({ syncGroupA: ref }),
  setActiveTheme: (theme) => set({ activeTheme: theme }),
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
