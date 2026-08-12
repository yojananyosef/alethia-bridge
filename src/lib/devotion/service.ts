import { ensureModuleDbReady, getModuleDb } from "../db/sqlite.ts";
import { getModule, listModules, readModuleInfo } from "../modules/registry.ts";
import { parseScriptureReference } from "../bible/reference-parser.ts";
import type { DevotionEntry, DevotionMoment, DevotionResponse, ParsedVerseRef } from "../../types/devotion.ts";

export { parseScriptureReference };

const devotionCache = new Map<string, DevotionResponse>();

export function readDevotion(
  monthParam?: number | null,
  dayParam?: number | null,
  momentParam?: DevotionMoment | null,
  requestedModuleId?: string | null,
  installedFilter?: string[] | null,
): DevotionResponse {
  const now = new Date();
  const month = monthParam && monthParam >= 1 && monthParam <= 12 ? monthParam : now.getMonth() + 1;
  const day = dayParam && dayParam >= 1 && dayParam <= 31 ? dayParam : now.getDate();

  // Si no se especifica momento, por la tarde/noche (>= 17 hrs) sugiere noche, de lo contrario mañana
  const defaultMoment: DevotionMoment = now.getHours() >= 17 ? "noche" : "manana";
  const moment: DevotionMoment = momentParam || defaultMoment;

  const cacheKey = `${month}:${day}:${moment}:${requestedModuleId ?? ""}:${(installedFilter ?? []).sort().join(",")}`;
  if (devotionCache.has(cacheKey)) {
    return devotionCache.get(cacheKey)!;
  }

  const t0 = performance.now();

  let candidateModules = listModules(installedFilter).filter(
    (m) => m.type === "devotion" && m.status === "installed",
  );

  if (candidateModules.length === 0 && requestedModuleId) {
    ensureModuleDbReady(requestedModuleId);
    const mod = readModuleInfo(requestedModuleId);
    if (mod) candidateModules = [mod];
  }

  const availableModules = candidateModules.map((m) => ({ id: m.id, name: m.name }));

  if (candidateModules.length === 0) {
    return {
      devotion: null,
      availableMoments: [],
      availableModules: [],
      durationMs: performance.now() - t0,
    };
  }

  const activeModuleInfo =
    (requestedModuleId && candidateModules.find((m) => m.id === requestedModuleId)) ||
    candidateModules.find((m) => m.id === "SPURGEON-ME") ||
    candidateModules[0];

  try {
    const db = getModuleDb(activeModuleInfo.id);
    // Verificar momentos disponibles para este día
    const momentRows = db
      .prepare(`SELECT DISTINCT momento FROM devocionales WHERE mes = ? AND dia = ?`)
      .all(month, day) as Array<{ momento: string }>;

    const availableMoments = momentRows.map((r) => r.momento as DevotionMoment);

    // Búsqueda con tolerancia a sinónimos ("manana" vs "dia")
    const momentAliases =
      moment === "manana" ? ["manana", "dia", "morning"] : moment === "dia" ? ["dia", "manana", "morning"] : ["noche", "evening"];

    let row: any = null;
    for (const mAlias of momentAliases) {
      row = db
        .prepare(
          `SELECT id_devocional, mes, dia, momento, titulo, pasaje_clave, texto, oracion
           FROM devocionales WHERE mes = ? AND dia = ? AND momento = ? LIMIT 1`,
        )
        .get(month, day, mAlias);
      if (row) break;
    }

    // Fallback: si no encuentra el momento exacto, toma el primer registro del día
    if (!row) {
      row = db
        .prepare(
          `SELECT id_devocional, mes, dia, momento, titulo, pasaje_clave, texto, oracion
           FROM devocionales WHERE mes = ? AND dia = ? LIMIT 1`,
        )
        .get(month, day);
    }

    if (!row) {
      return {
        devotion: null,
        availableMoments,
        availableModules,
        durationMs: performance.now() - t0,
      };
    }

    const parsedRef = parseScriptureReference(row.pasaje_clave);

    const devotion: DevotionEntry = {
      id: row.id_devocional,
      moduleId: activeModuleInfo.id,
      moduleName: activeModuleInfo.name,
      month: row.mes,
      day: row.dia,
      moment: row.momento,
      title: row.titulo,
      keyVerse: row.pasaje_clave,
      text: row.texto,
      prayer: row.oracion || null,
      parsedReference: parsedRef,
    };

    const res: DevotionResponse = {
      devotion,
      availableMoments,
      availableModules,
      durationMs: performance.now() - t0,
    };
    devotionCache.set(cacheKey, res);
    return res;
  } catch {
    return {
      devotion: null,
      availableMoments: [],
      availableModules,
      durationMs: performance.now() - t0,
    };
  }
}
