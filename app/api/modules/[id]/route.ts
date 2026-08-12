import { rmSync, existsSync } from "node:fs";
import path from "node:path";
import { clearModuleInfoCache, getModule, setModuleEnabled } from "../../../../src/lib/modules/registry.ts";
import { closeModuleDb, ensureModuleReadyAsync, getWritableModulesDir, MODULES_DIR, TMP_MODULES_DIR } from "../../../../src/lib/db/sqlite.ts";

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
    await ensureModuleReadyAsync(id);
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

/** DELETE /api/modules/:id → desinstala el módulo (borra los archivos .db y limpia conexiones). */
export async function DELETE(_request: Request, ctx: RouteContext<"/api/modules/[id]">): Promise<Response> {
  try {
    const { id } = await ctx.params;
    closeModuleDb(id);
    clearModuleInfoCache(id);

    const removeFileSafely = async (filePath: string) => {
      if (!existsSync(/*turbopackIgnore: true*/ filePath)) return;
      for (let attempt = 0; attempt < 8; attempt++) {
        try {
          rmSync(/*turbopackIgnore: true*/ filePath, { force: true });
          return;
        } catch {
          if (attempt === 7) break;
          await new Promise((resolve) => setTimeout(resolve, 30));
        }
      }
    };

    const targetDirs = [MODULES_DIR, getWritableModulesDir(), TMP_MODULES_DIR];
    for (const dir of targetDirs) {
      for (const ext of [".db", ".db-wal", ".db-shm", ".db-journal"]) {
        const file = path.join(/*turbopackIgnore: true*/ dir, `${id}${ext}`);
        await removeFileSafely(file);
      }
    }
    clearModuleInfoCache(id);
    return Response.json({ ok: true, moduleId: id });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Error interno" },
      { status: 500 },
    );
  }
}
