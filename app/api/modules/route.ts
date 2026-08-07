import { listModules } from "../../../src/lib/modules/registry.ts";
import { installModuleZip } from "../../../src/lib/modules/package.ts";
import type { ModuleListResponse } from "../../../src/types/module.ts";

export const dynamic = "force-dynamic";

const MAX_UPLOAD_BYTES = 512 * 1024 * 1024;

/** GET /api/modules → lista de módulos instalados con manifest + canon. */
export async function GET(): Promise<Response> {
  try {
    const t0 = performance.now();
    const body: ModuleListResponse = {
      modules: listModules(),
      durationMs: performance.now() - t0,
    };
    return Response.json(body);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Error interno" },
      { status: 500 },
    );
  }
}

/** POST /api/modules → instala un paquete .abmod (multipart/form-data, campo "file"). */
export async function POST(request: Request): Promise<Response> {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return Response.json({ error: "campo 'file' requerido (.abmod)" }, { status: 400 });
    }
    if (!file.name.toLowerCase().endsWith(".abmod")) {
      return Response.json({ error: "el archivo debe terminar en .abmod" }, { status: 400 });
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return Response.json({ error: "el paquete supera 512MB" }, { status: 413 });
    }
    const result = installModuleZip(new Uint8Array(await file.arrayBuffer()));
    if (!result.ok) {
      return Response.json({ error: result.error }, { status: 422 });
    }
    return Response.json({ ok: true, moduleId: result.moduleId });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Error interno" },
      { status: 500 },
    );
  }
}
