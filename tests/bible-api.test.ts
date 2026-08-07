import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { GET as readGET } from "../app/api/bible/read/route.ts";
import { GET as searchGET } from "../app/api/bible/search/route.ts";
import type { ReadResponse, SearchResponse } from "../src/types/bible.ts";

const READ_URL = "http://localhost/api/bible/read?book=Jn&chapter=3&modules=RV1909,NA28";

async function readApi(url: string): Promise<{ status: number; body: ReadResponse }> {
  const res = await readGET(new Request(url));
  return { status: res.status, body: (await res.json()) as ReadResponse };
}

async function searchApi(url: string): Promise<{ status: number; body: SearchResponse }> {
  const res = await searchGET(new Request(url));
  return { status: res.status, body: (await res.json()) as SearchResponse };
}

describe("API /api/bible/read", () => {
  test("responde 200 con módulos interlineales y cumple SLA < 10ms", async () => {
    await readApi(READ_URL); // warm-up: apertura de conexiones WAL (se amortiza en producción)
    const { status, body } = await readApi(READ_URL);
    assert.equal(status, 200);
    assert.equal(body.modules.length, 2);
    assert.deepEqual(body.modules.map((m) => m.moduleId), ["RV1909", "NA28"]);
    assert.equal(body.modules[0].verses.length, 36);
    assert.ok(body.durationMs < 10, `SLA read excedido: ${body.durationMs}ms`);
  });

  test("Jn 3:16 tiene tokens alineados entre módulos (misma alineacion_id)", async () => {
    const { body } = await readApi(READ_URL);
    const es = body.modules[0].verses.find((v) => v.verse === 16)!;
    const gr = body.modules[1].verses.find((v) => v.verse === 16)!;
    assert.ok(es.tokens.length > 20);
    assert.ok(gr.tokens.length > 20);

    const esIds = new Set(es.tokens.map((t) => t.alignmentId));
    const grIds = new Set(gr.tokens.map((t) => t.alignmentId));
    const pares = [...grIds].filter((id) => esIds.has(id)).length;
    assert.ok(pares > 10, `pocos pares alineados: ${pares}`);

    const dios = gr.tokens.find((t) => t.text === "θεὸς");
    assert.equal(dios?.strongId, "G2316");
    const amos = gr.tokens.find((t) => t.text === "ἠγάπησεν");
    assert.equal(amos?.morphCode, "V-AIA-3S");
    assert.ok(amos?.lemma?.includes("ἀγαπάω"));
  });

  test("parametros invalidos → 400", async () => {
    const bad = await readApi("http://localhost/api/bible/read?book=&chapter=99999");
    assert.equal(bad.status, 400);
  });
});

describe("API /api/bible/search", () => {
  test("búsqueda FTS5 español con comodín sobre el texto completo y SLA < 30ms", async () => {
    const { status, body } = await searchApi(
      "http://localhost/api/bible/search?q=Esp%C3%ADritu&modules=RV1909",
    );
    assert.equal(status, 200);
    assert.ok(body.results.length > 0);
    assert.ok(body.total > 100, `esperaba búsqueda sobre el texto completo (total=${body.total})`);
    assert.ok(body.results[0].snippet.includes("<mark>"));
    assert.ok(body.durationMs < 30, `SLA search excedido: ${body.durationMs}ms`);
  });

  test("búsqueda insensible a acentos (Espiritu sin tilde → Espíritu)", async () => {
    const { body } = await searchApi("http://localhost/api/bible/search?q=Espiritu&modules=RV1909");
    assert.ok(body.results.length > 0, "sin resultados para 'Espiritu'");
  });

  test("búsqueda en el texto completo encuentra Nicodemo en Juan 3", async () => {
    const { body } = await searchApi("http://localhost/api/bible/search?q=Nicodemo&modules=RV1909");
    const vv = body.results.map((r) => r.verse);
    assert.ok(vv.includes(1), `falta Jn 3:1 (versículos: ${vv.join(",")})`);
    assert.ok(vv.includes(9), `falta Jn 3:9 (versículos: ${vv.join(",")})`);
  });

  test("búsqueda griega por prefijo (lemas/acentos)", async () => {
    const { body } = await searchApi(
      "http://localhost/api/bible/search?q=%CF%80%CE%B9%CF%83%CF%84%CE%B5%CF%85&modules=NA28",
    );
    const vv = body.results.map((r) => r.verse);
    assert.ok(vv.includes(16));
    assert.ok(vv.includes(36));
  });

  test("búsqueda por Strong number G25", async () => {
    const { body } = await searchApi("http://localhost/api/bible/search?q=G25&modules=NA28");
    assert.ok(body.results.length > 0);
    assert.ok(body.results.every((r) => r.strongIds.includes("G25")));
  });

  test("devuelve snippets con <mark>", async () => {
    const { body } = await searchApi("http://localhost/api/bible/search?q=cielo&modules=RV1909");
    assert.ok(body.results.length > 0);
    assert.ok(body.results[0].snippet.includes("<mark>"));
  });
});
