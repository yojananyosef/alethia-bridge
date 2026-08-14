import { downloadAndInstallRemoteModule } from "../../../../src/lib/modules/catalog-service.ts";
import type { InstallRemoteRequest } from "../../../../src/types/catalog.ts";

export const dynamic = "force-dynamic";

/**
 * POST /api/modules/install-remote
 * Descarga e instala un módulo desde el catálogo remoto o repositorio de assets.
 * Resuelve dependencias automáticamente en cadena (ej. RV1909 -> lexicon).
 * Valida la integridad del archivo mediante SHA-256 e instala atómicamente.
 */
export async function POST(request: Request): Promise<Response> {
  let body: Partial<InstallRemoteRequest> = {};
  try {
    body = (await request.json()) as Partial<InstallRemoteRequest>;

    if (!body.moduleId || typeof body.moduleId !== "string") {
      return Response.json(
        { error: "Campo 'moduleId' (string) requerido en el cuerpo de la petición" },
        { status: 400 },
      );
    }

    const result = await downloadAndInstallRemoteModule({
      moduleId: body.moduleId.trim(),
      downloadUrl: body.downloadUrl,
      sha256: body.sha256,
      force: Boolean(body.force),
    });

    return Response.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al instalar el módulo remoto";
    const stack = err instanceof Error ? err.stack : undefined;
    const code = err instanceof Error && "code" in err ? (err as NodeJS.ErrnoException).code : undefined;
    console.error("[install-remote]", { moduleId: body.moduleId, message, code, stack });
    const isValidationError =
      message.includes("SHA-256") || message.includes("no coincide");
    return Response.json(
      { error: message, code, stack: process.env.NODE_ENV === "production" ? undefined : stack },
      { status: isValidationError ? 422 : 500 },
    );
  }
}
