import {
  getLexiconEntry,
  getMorphology,
  getProperNames,
  readChapter,
  readCommentary,
  readCrossReferences,
} from "../../../../src/lib/bible/service.ts";
import { getInstalledIdsFromRequest } from "../../../../src/lib/modules/registry.ts";
import { ensureModuleReadyAsync } from "../../../../src/lib/db/sqlite.ts";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const installedFilter = getInstalledIdsFromRequest(request);
    const name = url.searchParams.get("name");
    if (name) {
      const nombres = getProperNames(
        name.toUpperCase(),
        url.searchParams.get("book") ?? undefined,
      );
      return Response.json({ nombres });
    }
    const crossref = url.searchParams.get("crossref");
    if (crossref) {
      if (!installedFilter || installedFilter.includes("TSK")) {
        await ensureModuleReadyAsync("TSK");
      }
      const data = readCrossReferences(
        url.searchParams.get("book") ?? "",
        url.searchParams.get("chapter") ?? "",
        url.searchParams.get("verse"),
        installedFilter,
      );
      return Response.json(data);
    }
    const commentary = url.searchParams.get("commentary");
    if (commentary) {
      if (installedFilter && installedFilter.length > 0) {
        await Promise.all(installedFilter.map((id) => ensureModuleReadyAsync(id)));
      }
      const data = readCommentary(
        url.searchParams.get("book") ?? "",
        url.searchParams.get("chapter") ?? "",
        installedFilter,
      );
      return Response.json(data);
    }
    const lexicon = url.searchParams.get("lexicon");
    if (lexicon) {
      if (!installedFilter || installedFilter.includes("lexicon")) {
        await ensureModuleReadyAsync("lexicon");
      }
      const entry = getLexiconEntry(lexicon.toUpperCase());
      if (!entry) return Response.json({ error: "Strong no encontrado" }, { status: 404 });
      return Response.json({ lexicon: entry });
    }
    const morph = url.searchParams.get("morph");
    if (morph) {
      if (!installedFilter || installedFilter.includes("lexicon")) {
        await ensureModuleReadyAsync("lexicon");
      }
      const analysis = getMorphology(morph.toUpperCase());
      if (!analysis) return Response.json({ error: "Código morfológico no encontrado" }, { status: 404 });
      return Response.json({ morph: analysis });
    }

    const requestedModuleStr = url.searchParams.get("modules");
    if (requestedModuleStr) {
      const ids = requestedModuleStr
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter((id) => Boolean(id) && (!installedFilter || installedFilter.includes(id)));
      if (ids.length > 0) {
        await Promise.all(ids.map((id) => ensureModuleReadyAsync(id)));
      }
    }

    const data = readChapter(
      url.searchParams.get("book") ?? "",
      url.searchParams.get("chapter") ?? "",
      requestedModuleStr,
    );
    return Response.json(data);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Error interno" },
      { status: 400 },
    );
  }
}