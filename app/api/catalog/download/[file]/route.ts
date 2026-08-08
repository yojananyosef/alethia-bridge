import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";

const DIST_MODULES_DIR = path.join(process.cwd(), "dist-modules");

/**
 * GET /api/catalog/download/[file]
 * Sirve los binarios de módulos (.abmod) para descarga local, pruebas E2E o despliegue autónomo.
 */
export async function GET(
  _request: Request,
  props: { params: Promise<{ file: string }> },
): Promise<Response> {
  try {
    const { file } = await props.params;
    const safeFile = path.basename(file);

    if (!safeFile.endsWith(".abmod")) {
      return Response.json({ error: "Solo se pueden descargar archivos .abmod" }, { status: 400 });
    }

    const filePath = path.join(DIST_MODULES_DIR, safeFile);
    if (!existsSync(filePath)) {
      return Response.json({ error: `Paquete no encontrado: ${safeFile}` }, { status: 404 });
    }

    const stat = statSync(filePath);
    const bytes = readFileSync(filePath);

    return new Response(bytes, {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Length": String(stat.size),
        "Content-Disposition": `attachment; filename="${safeFile}"`,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Error al descargar el módulo" },
      { status: 500 },
    );
  }
}
