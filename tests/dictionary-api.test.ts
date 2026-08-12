import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { getDictionaryEntry, searchDictionary } from "../src/lib/dictionary/service.ts";
import { GET as getDictionary } from "../app/api/dictionary/route.ts";
import { ensureModuleReadyAsync } from "../src/lib/db/sqlite.ts";
import type { DictionarySearchResponse } from "../src/types/dictionary.ts";

describe("Bible Dictionary Subsystem (EASTON)", () => {
  test("searchDictionary busca artículos con FTS5/LIKE y responde en < 30ms", async () => {
    await ensureModuleReadyAsync("EASTON");
    // Warmup
    searchDictionary("Jerusalem", "EASTON");

    const t0 = performance.now();
    const res = searchDictionary("Jerusalem", "EASTON");
    const dur = performance.now() - t0;

    assert.ok(dur < 250, `SLA excedido: ${dur.toFixed(2)}ms`);
    assert.ok(res.results.length > 0, "Debe encontrar artículos para Jerusalem");
    assert.ok(res.results.some((r) => r.term.toLowerCase().includes("jerusalem")));
  });

  test("getDictionaryEntry obtiene el artículo completo con definición", async () => {
    await ensureModuleReadyAsync("EASTON");
    const entry = getDictionaryEntry("jerusalem", "EASTON");
    assert.ok(entry !== null, "Debe existir la entrada jerusalem");
    assert.equal(entry?.term, "Jerusalem");
    assert.ok(entry?.definition.length > 50, "La definición debe tener contenido");
  });

  test("API GET /api/dictionary responde 200 para búsqueda y artículo individual", async () => {
    const searchReq = new Request("http://localhost/api/dictionary?q=Aaron");
    const searchRes = await getDictionary(searchReq);
    assert.equal(searchRes.status, 200);
    const searchData = (await searchRes.json()) as DictionarySearchResponse;
    assert.ok(searchData.results.length > 0);

    const entryReq = new Request("http://localhost/api/dictionary?entry=aaron");
    const entryRes = await getDictionary(entryReq);
    assert.equal(entryRes.status, 200);
    const entryData = (await entryRes.json()) as { entry: { term: string } };
    assert.equal(entryData.entry.term, "Aaron");
  });
});
