"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownToLine,
  BookMarked,
  BookOpen,
  Check,
  CheckCircle2,
  Clock,
  Download,
  Globe2,
  Info,
  Layers,
  Loader2,
  Package,
  PackageCheck,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Tag,
  Trash2,
  Upload,
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
import type { CatalogItem, CatalogResponse, InstallRemoteResponse } from "../../types/catalog";
import { cn } from "../../lib/utils";
import { useExegesisStore } from "../../store/useExegesisStore";

interface LibraryManagerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onModuleChanged?: () => void;
}

const TYPE_CONFIG = {
  bible: { label: "Biblia", icon: BookOpen, color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30" },
  lexicon: { label: "Léxico / Strong", icon: BookMarked, color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" },
  commentary: { label: "Comentario", icon: Layers, color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30" },
  crossref: { label: "Ref. Cruzadas", icon: Tag, color: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30" },
  devotion: { label: "Devocional", icon: Sparkles, color: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30" },
};

const LANG_CONFIG: Record<string, { label: string; flag: string }> = {
  es: { label: "Español", flag: "ES" },
  el: { label: "Griego Koiné", flag: "GR" },
  he: { label: "Hebreo Masorético", flag: "HE" },
  en: { label: "Inglés", flag: "EN" },
  la: { label: "Latín", flag: "LA" },
};

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export function LibraryManagerModal({
  open,
  onOpenChange,
  onModuleChanged,
}: LibraryManagerModalProps) {
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [installingId, setInstallingId] = useState<string | null>(null);
  const [installProgressText, setInstallProgressText] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "bible" | "lexicon" | "commentary" | "updates" | "installed">("all");
  const [langFilter, setLangFilter] = useState<string>("ALL");

  const { activeModules, toggleModule, addInstalledModule, removeInstalledModule } = useExegesisStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadCatalog = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/catalog${forceRefresh ? "?refresh=1" : ""}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as CatalogResponse;
      setCatalog(data);
    } catch (e) {
      setNotification({
        type: "error",
        text: `Error al conectar con el catálogo: ${e instanceof Error ? e.message : String(e)}`,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      queueMicrotask(() => {
        void loadCatalog(false);
      });
    }
  }, [open, loadCatalog]);

  const handleInstallRemote = async (moduleItem: CatalogItem, force = false) => {
    setInstallingId(moduleItem.id);
    setInstallProgressText(`Descargando e instalando ${moduleItem.name}…`);
    setNotification(null);

    try {
      const res = await fetch("/api/modules/install-remote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          moduleId: moduleItem.id,
          downloadUrl: moduleItem.downloadUrl,
          sha256: moduleItem.sha256,
          force,
        }),
      });

      const body = (await res.json()) as InstallRemoteResponse;
      if (!res.ok || !body.ok) {
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }

      addInstalledModule(moduleItem.id);
      for (const depId of body.installedDependencies ?? []) {
        addInstalledModule(depId);
      }

      if (moduleItem.type === "bible" && !activeModules.includes(moduleItem.id)) {
        toggleModule(moduleItem.id);
      }

      setNotification({
        type: "success",
        text: `¡Módulo "${moduleItem.name}" (${moduleItem.id}) instalado y verificado con éxito!`,
      });

      await loadCatalog(true);
      onModuleChanged?.();
    } catch (e) {
      setNotification({
        type: "error",
        text: `Fallo en la instalación: ${e instanceof Error ? e.message : String(e)}`,
      });
    } finally {
      setInstallingId(null);
      setInstallProgressText(null);
    }
  };

  const handleToggleModule = async (moduleItem: CatalogItem) => {
    try {
      const nextStatus = moduleItem.localStatus === "disabled";
      await fetch(`/api/modules/${encodeURIComponent(moduleItem.id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled: nextStatus }),
      });
      if (moduleItem.type === "bible") {
        if (nextStatus && !activeModules.includes(moduleItem.id)) {
          toggleModule(moduleItem.id);
        } else if (!nextStatus && activeModules.includes(moduleItem.id)) {
          toggleModule(moduleItem.id);
        }
      }
      await loadCatalog(true);
      onModuleChanged?.();
    } catch (e) {
      setNotification({
        type: "error",
        text: `Error al cambiar estado: ${e instanceof Error ? e.message : String(e)}`,
      });
    }
  };

  const handleUninstall = async (moduleItem: CatalogItem) => {
    if (!window.confirm(`¿Seguro que deseas desinstalar el módulo "${moduleItem.name}" (${moduleItem.id})?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/modules/${encodeURIComponent(moduleItem.id)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      removeInstalledModule(moduleItem.id);
      if (activeModules.includes(moduleItem.id)) {
        toggleModule(moduleItem.id);
      }
      setNotification({
        type: "success",
        text: `Módulo "${moduleItem.id}" desinstalado correctamente.`,
      });
      await loadCatalog(true);
      onModuleChanged?.();
    } catch (e) {
      setNotification({
        type: "error",
        text: `Error al desinstalar: ${e instanceof Error ? e.message : String(e)}`,
      });
    }
  };

  const handleFileUpload = async (file: File) => {
    setInstallingId("UPLOAD");
    setInstallProgressText(`Procesando e instalando paquete local "${file.name}"…`);
    setNotification(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/modules", { method: "POST", body: form });
      const body = (await res.json()) as { ok?: boolean; moduleId?: string; error?: string };
      if (!res.ok || !body.ok) throw new Error(body.error ?? `HTTP ${res.status}`);

      setNotification({
        type: "success",
        text: `Paquete local instalado con éxito (${body.moduleId}).`,
      });
      await loadCatalog(true);
      onModuleChanged?.();
    } catch (e) {
      setNotification({
        type: "error",
        text: `Error al subir paquete: ${e instanceof Error ? e.message : String(e)}`,
      });
    } finally {
      setInstallingId(null);
      setInstallProgressText(null);
    }
  };

  const filteredModules = useMemo(() => {
    if (!catalog?.modules) return [];
    return catalog.modules.filter((m) => {
      // Filtro de pestaña
      if (activeTab === "bible" && m.type !== "bible") return false;
      if (activeTab === "lexicon" && m.type !== "lexicon") return false;
      if (activeTab === "commentary" && m.type !== "commentary") return false;
      if (activeTab === "updates" && m.installStatus !== "update_available") return false;
      if (activeTab === "installed" && m.installStatus === "not_installed") return false;

      // Filtro de idioma
      if (langFilter !== "ALL" && m.language !== langFilter) return false;

      // Búsqueda de texto
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesName = m.name.toLowerCase().includes(q);
        const matchesId = m.id.toLowerCase().includes(q);
        const matchesDesc = (m.description || "").toLowerCase().includes(q);
        const matchesPub = (m.publisher || "").toLowerCase().includes(q);
        if (!matchesName && !matchesId && !matchesDesc && !matchesPub) return false;
      }

      return true;
    });
  }, [catalog, activeTab, langFilter, search]);

  const updateCount = catalog?.updatesCount ?? 0;
  const installedCount = catalog?.installedCount ?? 0;
  const totalCount = catalog?.modules.length ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] sm:w-full max-w-5xl h-[92vh] sm:h-[88vh] flex flex-col p-0 overflow-hidden bg-card text-foreground rounded-2xl border border-border shadow-2xl">
        {/* Cabecera Principal */}
        <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-5 pb-3 sm:pb-4 border-b border-border bg-card/80 backdrop-blur-md">
          <div className="flex items-center justify-between gap-2 sm:gap-4 pr-6 sm:pr-8">
            <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
              <div className="size-8 sm:size-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-xs shrink-0">
                <Package className="size-4 sm:size-5" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-base sm:text-lg font-bold tracking-tight truncate">
                  Biblioteca & Catálogo Remoto
                </DialogTitle>
                <DialogDescription className="hidden sm:block text-xs text-muted-foreground truncate">
                  Instala con 1 clic Biblias con Strongs, Textos Originales, Léxicos y Comentarios con verificación SHA-256.
                </DialogDescription>
              </div>
            </div>

            {/* Acciones de Cabecera */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void loadCatalog(true)}
                disabled={loading}
                className="h-8 px-2 sm:px-3 gap-1 sm:gap-1.5 text-xs font-semibold"
                title="Actualizar catálogo remoto"
              >
                <RefreshCw className={cn("size-3.5", loading && "animate-spin text-primary")} />
                <span className="hidden sm:inline">Refrescar</span>
              </Button>

              <Button
                variant="default"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={Boolean(installingId)}
                className="h-8 px-2 sm:px-3 gap-1 sm:gap-1.5 text-xs font-semibold shadow-xs"
                title="Instalar archivo .abmod local"
              >
                <Upload className="size-3.5" />
                <span className="hidden sm:inline">Subir .abmod</span>
                <span className="inline sm:hidden">.abmod</span>
              </Button>

              <input
                ref={fileInputRef}
                type="file"
                accept=".abmod"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleFileUpload(f);
                  e.target.value = "";
                }}
              />
            </div>
          </div>

          {/* Tarjetas de Estadísticas Rápidas: 2x2 en móvil, 4 en desktop */}
          <div className="mt-2.5 sm:mt-3.5 grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2.5">
            <div className="rounded-xl border border-border/80 bg-muted/20 px-2.5 sm:px-3 py-1.5 sm:py-2 flex items-center justify-between">
              <div className="min-w-0">
                <span className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block truncate">
                  Disponibles
                </span>
                <span className="text-xs sm:text-sm font-bold text-foreground truncate block">{totalCount} módulos</span>
              </div>
              <Globe2 className="size-3.5 sm:size-4 text-primary/70 shrink-0 ml-1" />
            </div>

            <div className="rounded-xl border border-border/80 bg-muted/20 px-2.5 sm:px-3 py-1.5 sm:py-2 flex items-center justify-between">
              <div className="min-w-0">
                <span className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block truncate">
                  Instalados
                </span>
                <span className="text-xs sm:text-sm font-bold text-foreground truncate block">{installedCount} en SQLite</span>
              </div>
              <PackageCheck className="size-3.5 sm:size-4 text-emerald-500 shrink-0 ml-1" />
            </div>

            <div className="rounded-xl border border-border/80 bg-muted/20 px-2.5 sm:px-3 py-1.5 sm:py-2 flex items-center justify-between">
              <div className="min-w-0">
                <span className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block truncate">
                  Updates
                </span>
                <span className="text-xs sm:text-sm font-bold text-foreground truncate block">
                  {updateCount > 0 ? (
                    <span className="text-amber-500 font-extrabold">{updateCount} pendientes</span>
                  ) : (
                    <span className="text-muted-foreground">Al día</span>
                  )}
                </span>
              </div>
              <ArrowDownToLine className={cn("size-3.5 sm:size-4 shrink-0 ml-1", updateCount > 0 ? "text-amber-500 animate-bounce" : "text-muted-foreground")} />
            </div>

            <div className="rounded-xl border border-border/80 bg-muted/20 px-2.5 sm:px-3 py-1.5 sm:py-2 flex items-center justify-between">
              <div className="min-w-0">
                <span className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block truncate">
                  Seguridad
                </span>
                <span className="text-[10px] sm:text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 truncate block">SHA-256 Verif.</span>
              </div>
              <ShieldCheck className="size-3.5 sm:size-4 text-emerald-500 shrink-0 ml-1" />
            </div>
          </div>
        </DialogHeader>

        {/* Notificaciones y Estado de Progreso */}
        {installProgressText && (
          <div className="bg-primary/10 border-b border-primary/20 px-4 sm:px-6 py-2 sm:py-2.5 flex items-center gap-2 sm:gap-3 animate-in fade-in-0">
            <Loader2 className="size-3.5 sm:size-4 text-primary animate-spin shrink-0" />
            <span className="text-xs font-semibold text-primary truncate">{installProgressText}</span>
          </div>
        )}

        {notification && (
          <div
            className={cn(
              "px-4 sm:px-6 py-2 sm:py-2.5 border-b text-xs font-semibold flex items-center justify-between gap-2 animate-in fade-in-0",
              notification.type === "success"
                ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                : "bg-destructive/15 border-destructive/30 text-destructive",
            )}
          >
            <div className="flex items-center gap-2 min-w-0">
              {notification.type === "success" ? (
                <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
              ) : (
                <Info className="size-4 shrink-0 text-destructive" />
              )}
              <span className="truncate">{notification.text}</span>
            </div>
            <button
              onClick={() => setNotification(null)}
              className="p-1 hover:bg-black/10 rounded shrink-0"
            >
              <X className="size-3.5" />
            </button>
          </div>
        )}

        {/* Barra de Filtros y Búsqueda */}
        <div className="px-3.5 sm:px-6 py-2.5 sm:py-3 border-b border-border/60 bg-muted/10 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3">
          {/* Pestañas de Recursos con scroll horizontal fluido en móvil */}
          <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-xl border border-border/60 text-xs font-medium overflow-x-auto scrollbar-thin">
            <button
              onClick={() => setActiveTab("all")}
              className={cn(
                "px-2 sm:px-2.5 py-1 rounded-lg transition-all shrink-0 text-[11px] sm:text-xs",
                activeTab === "all" ? "bg-card text-foreground font-bold shadow-xs" : "text-muted-foreground hover:text-foreground",
              )}
            >
              Todos ({totalCount})
            </button>
            <button
              onClick={() => setActiveTab("bible")}
              className={cn(
                "px-2 sm:px-2.5 py-1 rounded-lg transition-all shrink-0 text-[11px] sm:text-xs",
                activeTab === "bible" ? "bg-card text-foreground font-bold shadow-xs" : "text-muted-foreground hover:text-foreground",
              )}
            >
              Biblias
            </button>
            <button
              onClick={() => setActiveTab("lexicon")}
              className={cn(
                "px-2 sm:px-2.5 py-1 rounded-lg transition-all shrink-0 text-[11px] sm:text-xs",
                activeTab === "lexicon" ? "bg-card text-foreground font-bold shadow-xs" : "text-muted-foreground hover:text-foreground",
              )}
            >
              Léxicos
            </button>
            <button
              onClick={() => setActiveTab("commentary")}
              className={cn(
                "px-2 sm:px-2.5 py-1 rounded-lg transition-all shrink-0 text-[11px] sm:text-xs",
                activeTab === "commentary" ? "bg-card text-foreground font-bold shadow-xs" : "text-muted-foreground hover:text-foreground",
              )}
            >
              Comentarios
            </button>
            <button
              onClick={() => setActiveTab("installed")}
              className={cn(
                "px-2 sm:px-2.5 py-1 rounded-lg transition-all shrink-0 text-[11px] sm:text-xs",
                activeTab === "installed" ? "bg-card text-foreground font-bold shadow-xs" : "text-muted-foreground hover:text-foreground",
              )}
            >
              Instalados ({installedCount})
            </button>
            {updateCount > 0 && (
              <button
                onClick={() => setActiveTab("updates")}
                className={cn(
                  "px-2 sm:px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 shrink-0 text-[11px] sm:text-xs",
                  activeTab === "updates" ? "bg-amber-500 text-white font-bold shadow-xs" : "text-amber-500 font-semibold hover:text-amber-600",
                )}
              >
                <span>Updates</span>
                <span className="rounded-full bg-amber-600/30 px-1 py-0.2 text-[9px] font-mono">
                  {updateCount}
                </span>
              </button>
            )}
          </div>

          {/* Filtros secundarios: Idioma y Búsqueda */}
          <div className="flex items-center gap-2 sm:gap-2.5 w-full sm:w-auto sm:max-w-md justify-between sm:justify-end">
            <div className="flex items-center gap-0.5 bg-muted/40 p-0.5 rounded-lg border border-border/60 text-[10px] sm:text-[11px] font-semibold shrink-0">
              <button
                onClick={() => setLangFilter("ALL")}
                className={cn(
                  "px-1.5 sm:px-2 py-1 rounded",
                  langFilter === "ALL" ? "bg-card text-foreground shadow-xs font-bold" : "text-muted-foreground hover:text-foreground",
                )}
              >
                Todos
              </button>
              <button
                onClick={() => setLangFilter("es")}
                className={cn(
                  "px-1.5 sm:px-2 py-1 rounded",
                  langFilter === "es" ? "bg-card text-foreground shadow-xs font-bold" : "text-muted-foreground hover:text-foreground",
                )}
              >
                ES
              </button>
              <button
                onClick={() => setLangFilter("el")}
                className={cn(
                  "px-1.5 sm:px-2 py-1 rounded",
                  langFilter === "el" ? "bg-card text-foreground shadow-xs font-bold" : "text-muted-foreground hover:text-foreground",
                )}
              >
                Griego
              </button>
              <button
                onClick={() => setLangFilter("he")}
                className={cn(
                  "px-1.5 sm:px-2 py-1 rounded",
                  langFilter === "he" ? "bg-card text-foreground shadow-xs font-bold" : "text-muted-foreground hover:text-foreground",
                )}
              >
                Hebreo
              </button>
            </div>

            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-2.5 top-2 size-3.5 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar módulo…"
                className="w-full rounded-lg border border-border bg-background py-1.5 pl-8 pr-7 text-xs text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary transition-colors"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Lista de Módulos */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-6 space-y-3 sm:space-y-3.5 scrollbar-thin">
          {loading && !catalog ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
              <Loader2 className="size-8 text-primary animate-spin" />
              <p className="text-xs font-semibold">Consultando catálogo remoto y módulos locales…</p>
            </div>
          ) : filteredModules.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Package className="size-10 text-muted-foreground/40 mb-3" />
              <h3 className="text-sm font-bold text-foreground">No se encontraron módulos</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                No hay recursos que coincidan con &ldquo;{search}&rdquo; o el filtro seleccionado.
              </p>
            </div>
          ) : (
            filteredModules.map((m) => {
              const typeCfg = TYPE_CONFIG[m.type] ?? TYPE_CONFIG.bible;
              const langCfg = LANG_CONFIG[m.language] ?? { label: m.language, flag: m.language.toUpperCase() };
              const isInstalling = installingId === m.id;
              const TypeIcon = typeCfg.icon;

              return (
                <div
                  key={m.id}
                  className={cn(
                    "group relative rounded-xl sm:rounded-2xl border p-3.5 sm:p-4.5 transition-all shadow-xs",
                    m.installStatus === "update_available"
                      ? "border-amber-500/40 bg-amber-500/5 hover:border-amber-500"
                      : m.installStatus === "installed"
                      ? "border-border/80 bg-card hover:border-primary/40"
                      : "border-border/60 bg-card/60 hover:border-border hover:bg-card",
                  )}
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
                    {/* Detalles del Recurso */}
                    <div className="space-y-1.5 flex-1 min-w-0 w-full">
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                        <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20">
                          {m.id}
                        </span>

                        <Badge variant="outline" className={cn("text-[10px] gap-1 font-semibold", typeCfg.color)}>
                          <TypeIcon className="size-3" />
                          <span>{typeCfg.label}</span>
                        </Badge>

                        <Badge variant="outline" className="text-[10px] font-mono border-border/80 text-muted-foreground">
                          {langCfg.label} ({langCfg.flag})
                        </Badge>

                        <span className="text-[11px] font-mono text-muted-foreground font-medium">
                          v{m.version}
                        </span>

                        {m.year > 0 && (
                          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <Clock className="size-3" /> {m.year}
                          </span>
                        )}

                        {m.hasStrongs && (
                          <span className="rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-1.5 py-0.2 text-[9px] font-mono font-bold">
                            Strongs
                          </span>
                        )}

                        {m.hasMorphology && (
                          <span className="rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 px-1.5 py-0.2 text-[9px] font-mono font-bold">
                            Morfología
                          </span>
                        )}
                      </div>

                      <div>
                        <h4 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                          {m.name}
                        </h4>
                        <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                          {m.description}
                        </p>
                      </div>

                      {/* Metadatos secundarios: Autor, Tamaño, Dependencias */}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-[11px] text-muted-foreground">
                        {m.publisher && (
                          <span>
                            Publicador: <strong className="text-foreground/80 font-medium">{m.publisher}</strong>
                          </span>
                        )}
                        <span>
                          Tamaño: <strong className="text-foreground/80 font-medium">{formatBytes(m.sizeBytes)}</strong>
                        </span>
                        <span>
                          Licencia: <strong className="text-foreground/80 font-medium">{m.license}</strong>
                        </span>

                        {/* Dependencias */}
                        {m.dependencies && m.dependencies.length > 0 && (
                          <div className="flex items-center gap-1">
                            <span>Requiere:</span>
                            {m.dependencies.map((dep) => (
                              <span
                                key={dep}
                                className={cn(
                                  "rounded px-1.5 py-0.2 text-[10px] font-mono font-semibold border",
                                  m.missingDependencies?.includes(dep)
                                    ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
                                    : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
                                )}
                                title={
                                  m.missingDependencies?.includes(dep)
                                    ? `Dependencia "${dep}" se descargará e instalará automáticamente`
                                    : `Dependencia "${dep}" ya satisfecha en local`
                                }
                              >
                                {dep} {m.missingDependencies?.includes(dep) ? "⚡ (auto)" : "✓"}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Lista de características si existen */}
                      {m.features && m.features.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1.5">
                          {m.features.map((feat, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/40 px-2 py-0.5 rounded-md border border-border/50"
                            >
                              <Check className="size-2.5 text-primary" />
                              <span>{feat}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Acciones del Módulo: full-width en móvil con separación limpia */}
                    <div className="w-full sm:w-auto flex items-center justify-between sm:justify-end gap-2 pt-2.5 sm:pt-0 border-t sm:border-t-0 border-border/40 shrink-0">
                      {m.installStatus === "not_installed" ? (
                        <Button
                          variant="default"
                          size="sm"
                          disabled={Boolean(installingId)}
                          onClick={() => void handleInstallRemote(m)}
                          className="h-8 gap-1.5 text-xs font-bold shadow-xs w-full sm:w-auto"
                        >
                          {isInstalling ? (
                            <>
                              <Loader2 className="size-3.5 animate-spin" />
                              <span>Instalando…</span>
                            </>
                          ) : (
                            <>
                              <Download className="size-3.5" />
                              <span>Instalar Módulo</span>
                            </>
                          )}
                        </Button>
                      ) : m.installStatus === "update_available" ? (
                        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                          <Button
                            variant="default"
                            size="sm"
                            disabled={Boolean(installingId)}
                            onClick={() => void handleInstallRemote(m, true)}
                            className="h-8 gap-1.5 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-xs w-full sm:w-auto"
                          >
                            {isInstalling ? (
                              <>
                                <Loader2 className="size-3.5 animate-spin" />
                                <span>Actualizando…</span>
                              </>
                            ) : (
                              <>
                                <ArrowDownToLine className="size-3.5 animate-pulse" />
                                <span>Actualizar a v{m.version}</span>
                              </>
                            )}
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
                          <div className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="size-3.5" />
                            <span>Instalado</span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => void handleToggleModule(m)}
                              className="h-8 px-2.5 text-xs font-semibold"
                              title={m.localStatus === "disabled" ? "Activar módulo" : "Desactivar módulo"}
                            >
                              {m.localStatus === "disabled" ? "Activar" : "Desactivar"}
                            </Button>

                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => void handleUninstall(m)}
                              className="size-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                              title="Desinstalar módulo"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
