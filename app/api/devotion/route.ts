import { readDevotion } from "../../../src/lib/devotion/service.ts";
import { getInstalledIdsFromRequest } from "../../../src/lib/modules/registry.ts";
import { ensureModuleReadyAsync } from "../../../src/lib/db/sqlite.ts";
import type { DevotionMoment } from "../../../src/types/devotion.ts";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const installedFilter = getInstalledIdsFromRequest(request);

    const monthStr = url.searchParams.get("month");
    const dayStr = url.searchParams.get("day");
    const momentStr = url.searchParams.get("moment");
    const moduleId = url.searchParams.get("moduleId") || url.searchParams.get("module") || "SPURGEON-ME";

    await ensureModuleReadyAsync(moduleId);

    const month = monthStr ? Number.parseInt(monthStr, 10) : undefined;
    const day = dayStr ? Number.parseInt(dayStr, 10) : undefined;
    const moment = momentStr ? (momentStr.toLowerCase() as DevotionMoment) : undefined;

    const data = readDevotion(month, day, moment, moduleId, installedFilter);
    return Response.json(data);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Error al consultar devocional" },
      { status: 500 },
    );
  }
}
