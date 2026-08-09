"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { ReaderFontSize, ReaderLayout, SyncGroupReference, ThemeId } from "../types/bible";

interface ExegesisState {
  /** Indica si el store ya fue hidratado desde localStorage para evitar flashes en SSR. */
  _hasHydrated: boolean;
  /** ID de alineación resaltado al hacer hover (resalte interlineal instantáneo). */
  hoveredAlignmentId: string | null;
  /** Término léxico seleccionado para el panel de análisis lateral (strong_id o lema). */
  activeLexiconTerm: string | null;
  /** Referencia actual del pasaje (Grupo de sincronización A) persistida entre recargas. */
  syncGroupA: SyncGroupReference;
  /** Tema de lectura. */
  activeTheme: ThemeId;
  /** Módulos activos en el lector (orden = orden de visualización). */
  activeModules: string[];
  /** Módulos instalados por el usuario persistidos en el cliente. */
  installedModules: string[];
  /** Layout del lector: "interleaved" (interlineal en línea) o "columns" (biblia paralela por columnas). */
  readerLayout: ReaderLayout;
  /** Tamaño de tipografía del lector bíblico. */
  fontSize: ReaderFontSize;
  /** Mostrar micro-etiquetas Strong en línea. */
  showStrongs: boolean;
  /** Mostrar códigos morfológicos en línea. */
  showMorphology: boolean;
  /** Color de resaltador activo ('yellow', 'green', 'blue', 'pink' o null). */
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
  addInstalledModule: (moduleId: string) => void;
  removeInstalledModule: (moduleId: string) => void;
  setReaderLayout: (layout: ReaderLayout) => void;
  setFontSize: (size: ReaderFontSize) => void;
  setShowStrongs: (show: boolean) => void;
  setShowMorphology: (show: boolean) => void;
  setActiveHighlightColor: (color: string | null) => void;
  setRightSidebarOpen: (open: boolean) => void;
  toggleRightSidebar: () => void;
  setHasHydrated: (val: boolean) => void;
}

export type ExegesisStore = ExegesisState & ExegesisActions;

function syncInstalledCookie(modules: string[]) {
  if (typeof document !== "undefined") {
    document.cookie = `alethia_installed=${encodeURIComponent(modules.join(","))}; path=/; max-age=31536000; SameSite=Lax`;
  }
}

/** Lee de forma síncrona en cliente el estado guardado para evitar CUALQUIER flash visual. */
function getInitialPersistedState() {
  const fallback = {
    syncGroupA: { book: "Gen", chapter: 1, verse: 1 },
    activeTheme: "academic-paper" as ThemeId,
    activeModules: ["RV1909"],
    installedModules: ["RV1909", "lexicon"],
    readerLayout: "interleaved" as ReaderLayout,
    fontSize: "base" as ReaderFontSize,
    showStrongs: true,
    showMorphology: true,
    isRightSidebarOpen: true,
  };

  if (typeof window === "undefined") return fallback;

  try {
    const raw = localStorage.getItem("alethia-exegesis-store");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.state?.syncGroupA?.book) {
        const state = {
          ...fallback,
          ...parsed.state,
          installedModules: parsed.state.installedModules ?? fallback.installedModules,
        };
        syncInstalledCookie(state.installedModules);
        return state;
      }
    }
  } catch {}

  syncInstalledCookie(fallback.installedModules);
  return fallback;
}

const initial = getInitialPersistedState();

export const useExegesisStore = create<ExegesisStore>()(
  persist(
    (set) => ({
      _hasHydrated: typeof window !== "undefined",
      hoveredAlignmentId: null,
      activeLexiconTerm: null,
      syncGroupA: initial.syncGroupA,
      activeTheme: initial.activeTheme,
      activeModules: initial.activeModules,
      installedModules: initial.installedModules,
      readerLayout: initial.readerLayout,
      fontSize: initial.fontSize,
      showStrongs: initial.showStrongs,
      showMorphology: initial.showMorphology,
      activeHighlightColor: null,
      isRightSidebarOpen: initial.isRightSidebarOpen,

      setHasHydrated: (val) => set({ _hasHydrated: val }),
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
          if (has) {
            // Si es el único módulo activo, no permitir deseleccionarlo (siempre debe quedar al menos 1 biblia)
            if (state.activeModules.length <= 1) {
              return state;
            }
            return {
              activeModules: state.activeModules.filter((m) => m !== moduleId),
            };
          }
          return {
            activeModules: [...state.activeModules, moduleId],
          };
        }),
      addInstalledModule: (moduleId) =>
        set((state) => {
          const list = state.installedModules.includes(moduleId)
            ? state.installedModules
            : [...state.installedModules, moduleId];
          syncInstalledCookie(list);
          return { installedModules: list };
        }),
      removeInstalledModule: (moduleId) =>
        set((state) => {
          const list = state.installedModules.filter((m) => m !== moduleId);
          let active = state.activeModules.filter((m) => m !== moduleId);
          if (active.length === 0) {
            const nextBible = list.find((id) => id !== moduleId && id !== "lexicon");
            active = [nextBible ?? "RV1909"];
          }
          syncInstalledCookie(list);
          return { installedModules: list, activeModules: active };
        }),
    }),
    {
      name: "alethia-exegesis-store",
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
        if (state?.installedModules) {
          syncInstalledCookie(state.installedModules);
        }
      },
      partialize: (state) => ({
        syncGroupA: state.syncGroupA,
        activeTheme: state.activeTheme,
        activeModules: state.activeModules,
        installedModules: state.installedModules,
        readerLayout: state.readerLayout,
        fontSize: state.fontSize,
        showStrongs: state.showStrongs,
        showMorphology: state.showMorphology,
        isRightSidebarOpen: state.isRightSidebarOpen,
      }),
    },
  ),
);
