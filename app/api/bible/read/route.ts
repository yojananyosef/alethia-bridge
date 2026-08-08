import { getLexiconEntry, getMorphology, getProperNames, readChapter } from "../../../../src/lib/bible/service.ts";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const name = url.searchParams.get("name");
    if (name) {
      const nombres = getProperNames(
        name.toUpperCase(),
        url.searchParams.get("book") ?? undefined,
      );
      return Response.json({ nombres });
    }
    const lexicon = url.searchParams.get("lexicon");
    if (lexicon) {
      const entry = getLexiconEntry(lexicon.toUpperCase());
      if (!entry) return Response.json({ error: "Strong no encontrado" }, { status: 404 });
      return Response.json({ lexicon: entry });
    }
    const morph = url.searchParams.get("morph");
    if (morph) {
      const analysis = getMorphology(morph.toUpperCase());
      if (!analysis) return Response.json({ error: "Código morfológico no encontrado" }, { status: 404 });
      return Response.json({ morph: analysis });
    }
    const data = readChapter(
      url.searchParams.get("book") ?? "",
      url.searchParams.get("chapter") ?? "",
      url.searchParams.get("modules"),
    );
    return Response.json(data);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Error interno" },
      { status: 400 },
    );
  }
}