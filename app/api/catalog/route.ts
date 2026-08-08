import { getCatalogWithInstallStatus } from "../../../src/lib/modules/catalog-service.ts";
import { getInstalledIdsFromRequest } from "../../../src/lib/modules/registry.ts";

export const dynamic = "force-dynamic";

/**
 * GET /api/catalog
 * Devuelve el catálogo unificado de módulos (remoto cruzado con el registry local).
 * Indica para cada recurso si está: not_installed, installed o update_available.
 * Soporta query param ?refresh=1 para invalidar la caché en memoria.
 */
export async function GET(request: Request): Promise<Response> {
  try {
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get("refresh") === "1" || searchParams.get("force") === "true";
    const installedFilter = getInstalledIdsFromRequest(request);

    const response = await getCatalogWithInstallStatus(forceRefresh, installedFilter);
    return Response.json(response);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Error al obtener el catálogo de módulos" },
      { status: 500 },
    );
  }
}
