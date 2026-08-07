import { rmSync, existsSync } from "node:fs";
import path from "node:path";
import { getModule, setModuleEnabled } from "../../../../src/lib/modules/registry.ts";
import { closeModuleDb, MODULES_DIR } from "../../../../src/lib/db/sqlite.ts";

export const dynamic = "force-dynamic";

/** PATCH /api/modules/:id → { enabled: boolean } activa/desactiva el módulo. */
export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/modules/[id]">,
): Promise<Response> {
  try {
    const { id } = await ctx.params;
    const body = (await request.json()) as { enabled?: boolean };
    if (typeof body.enabled !== "boolean") {
      return Response.json({ error: "campo 'enabled' (boolean) requerido" }, { status: 400 });
    }
    const updated = setModuleEnabled(id, body.enabled);
    if (!updated) return Response.json({ error: "módulo no instalado" }, { status: 404 });
    return Response.json({ module: updated });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Error interno" },
      { status: 500 },
    );
  }
}

/** DELETE /api/modules/:id → desinstala el módulo (borra el archivo .db). */
export async function DELETE(_request: Request, ctx: RouteContext<"/api/modules/[id]">): Promise<Response> {
  try {
    const { id } = await ctx.params;
    if (!getModule(id)) return Response.json({ error: "módulo no instalado" }, { status: 404 });
    closeModuleDb(id);
    for (const ext of [".db", ".db-wal", ".db-shm"]) {
      const file = path.join(MODULES_DIR, `${id}${ext}`);
      if (existsSync(file)) rmSync(file);
    }
    return Response.json({ ok: true, moduleId: id });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Error interno" },
      { status: 500 },
    );
  }
}
