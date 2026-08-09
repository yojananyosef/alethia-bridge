import { getDictionaryEntry, searchDictionary } from "../../../src/lib/dictionary/service.ts";
import { getInstalledIdsFromRequest } from "../../../src/lib/modules/registry.ts";
import { ensureModuleReadyAsync } from "../../../src/lib/db/sqlite.ts";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const installedFilter = getInstalledIdsFromRequest(request);

    const query = url.searchParams.get("q") ?? url.searchParams.get("query") ?? "";
    const entrySlug = url.searchParams.get("entry") ?? url.searchParams.get("term");
    const moduleId = url.searchParams.get("moduleId") ?? url.searchParams.get("module") ?? "EASTON";

    await ensureModuleReadyAsync(moduleId);

    if (entrySlug) {
      const entry = getDictionaryEntry(entrySlug, moduleId, installedFilter);
      if (!entry) {
        return Response.json({ error: "Artículo no encontrado en el diccionario" }, { status: 404 });
      }
      return Response.json({ entry });
    }

    const data = searchDictionary(query, moduleId, 50, installedFilter);
    return Response.json(data);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Error al consultar diccionario bíblico" },
      { status: 500 },
    );
  }
}
