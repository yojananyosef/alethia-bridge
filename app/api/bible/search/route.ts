import { searchBible } from "../../../../src/lib/bible/service.ts";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const q = url.searchParams.get("q") ?? "";
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 20, 1), 50);
    const data = searchBible(q, url.searchParams.get("modules"), limit);
    return Response.json(data);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Error interno" },
      { status: 400 },
    );
  }
}
