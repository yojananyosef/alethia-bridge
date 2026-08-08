import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { zipSync } from "fflate";
import { GET as readGET } from "../app/api/bible/read/route.ts";
import { GET as searchGET } from "../app/api/bible/search/route.ts";
import { POST } from "../app/api/modules/route.ts";
import type { CommentaryResponse, ReadResponse, SearchResponse } from "../src/types/bible.ts";

const READ_URL = "http://localhost/api/bible/read?book=Jn&chapter=3&modules=RV1909,SBLGNT";
const MODULES_DIR = path.join(process.cwd(), "data", "modules");
const TEST_COMMENTARY_ID = "testcommentary2";

async function readApi(url: string): Promise<{ status: number; body: ReadResponse }> {
  const res = await readGET(new Request(url));
  return { status: res.status, body: (await res.json()) as ReadResponse };
}

async function commentaryApi(url: string): Promise<{ status: number; body: CommentaryResponse }> {
  const res = await readGET(new Request(url));
  return { status: res.status, body: (await res.json()) as CommentaryResponse };
}

async function searchApi(url: string): Promise<{ status: number; body: SearchResponse }> {
  const res = await searchGET(new Request(url));
  return { status: res.status, body: (await res.json()) as SearchResponse };
}

/** Instala un módulo de comentario de prueba con una nota en Gen 1:1 y Jn 3:16. */
async function installTestCommentary(): Promise<void> {
  const target = path.join(MODULES_DIR, `${TEST_COMMENTARY_ID}.db`);
  await import("node:fs").then((fs) => fs.promises.rm(target, { force: true }));
  const tmp = path.join(MODULES_DIR, `.fixture-${TEST_COMMENTARY_ID}.db`);
  const db = new Database(tmp);
  db.exec(`CREATE TABLE meta (clave TEXT PRIMARY KEY, valor TEXT NOT NULL);
           CREATE TABLE comentarios (
             id_comentario INTEGER PRIMARY KEY AUTOINCREMENT,
             libro_id TEXT NOT NULL, capitulo INTEGER NOT NULL,
             versiculo INTEGER NOT NULL, texto TEXT NOT NULL,
             UNIQUE(libro_id, capitulo, versiculo));`);
  const manifest = {
    id: TEST_COMMENTARY_ID,
    name: "Comentario de prueba",
    type: "commentary",
    language: "es",
    version: "1.0.0",
    publisher: "Tests",
    license: "MIT",
    year: 2026,
    description: "Módulo de comentario para tests",
    schemaVersion: 1,
  };
  for (const [k, v] of Object.entries(manifest)) {
    db.prepare(`INSERT INTO meta (clave, valor) VALUES (?, ?)`).run(`manifest_${k}`, String(v));
  }
  db.prepare(
    `INSERT INTO comentarios (libro_id, capitulo, versiculo, texto) VALUES (?, ?, ?, ?)`,
  ).run("Gen", 1, 1, "Dios es el creador de todas las cosas.");
  db.prepare(
    `INSERT INTO comentarios (libro_id, capitulo, versiculo, texto) VALUES (?, ?, ?, ?)`,
  ).run("Jn", 3, 16, "El amor de Dios se muestra en la cruz.");
  db.close();

  const zip = zipSync({
    "manifest.json": new TextEncoder().encode(JSON.stringify(manifest)),
    "module.db": new Uint8Array(await import("node:fs").then((fs) => fs.promises.readFile(tmp))),
  });
  rmSync(tmp);
  const form = new FormData();
  form.append("file", new File([zip], `${TEST_COMMENTARY_ID}.abmod`, { type: "application/zip" }));
  const res = await POST(new Request("http://localhost/api/modules", { method: "POST", body: form }));
  if (res.status !== 200) {
    throw new Error(`instalación falló: ${res.status} ${await res.text()}`);
  }
}

describe("API /api/bible/read", () => {
  test("responde 200 con módulos interlineales y cumple SLA < 10ms", async () => {
    await readApi(READ_URL); // warm-up: apertura de conexiones WAL (se amortiza en producción)
    const { status, body } = await readApi(READ_URL);
    assert.equal(status, 200);
    assert.equal(body.modules.length, 2);
    assert.deepEqual(body.modules.map((m) => m.moduleId), ["RV1909", "SBLGNT"]);
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
    assert.equal(amos?.morphCode, "3AAI-S--");
    assert.ok(amos?.lemma?.includes("ἀγαπάω"));
  });

  test("Jn 1:1 alineado por strong canónico: Verbo↔λόγος, principio↔ἀρχῇ, era↔ἦν (G2258≡G1510)", async () => {
    const { body } = await readApi(
      "http://localhost/api/bible/read?book=Jn&chapter=1&modules=RV1909,SBLGNT",
    );
    const es = body.modules[0].verses.find((v) => v.verse === 1)!;
    const gr = body.modules[1].verses.find((v) => v.verse === 1)!;
    const id = (arr: { text: string; alignmentId: string }[], t: string) =>
      arr.find((x) => x.text === t)?.alignmentId;

    assert.equal(id(es.tokens, "principio"), id(gr.tokens, "ἀρχῇ"), "principio debe alinear con ἀρχῇ");
    assert.equal(id(es.tokens, "Verbo"), id(gr.tokens, "λόγος"), "Verbo debe alinear con λόγος");
    assert.equal(id(es.tokens, "era"), id(gr.tokens, "ἦν"), "era (G2258) debe alinear con ἦν (G1510)");
    assert.equal(id(es.tokens, "Dios"), id(gr.tokens, "θεόν"), "Dios debe alinear con θεόν");
  });

  test("parametros invalidos → 400", async () => {
    const bad = await readApi("http://localhost/api/bible/read?book=&chapter=99999");
    assert.equal(bad.status, 400);
  });
});

describe("API /api/bible/search", () => {
  test("búsqueda FTS5 español con comodín sobre el texto completo y SLA < 30ms", async () => {
    const url = "http://localhost/api/bible/search?q=Esp%C3%ADritu&modules=RV1909";
    await searchApi(url); // warm-up FTS5 (cold-start del término se amortiza en producción)
    const { status, body } = await searchApi(url);
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
      "http://localhost/api/bible/search?q=%CF%80%CE%B9%CF%83%CF%84%CE%B5%CF%85&modules=SBLGNT",
    );
    assert.ok(body.total > 50, `esperaba cobertura sobre el NT completo (total=${body.total})`);
    assert.ok(body.results.length > 0);
    assert.ok(body.results.some((r) => r.book === "Jn" && r.chapter === 3), "Juan 3 debe estar entre los resultados");
  });

  test("búsqueda por Strong number G25", async () => {
    const { body } = await searchApi("http://localhost/api/bible/search?q=G25&modules=SBLGNT");
    assert.ok(body.results.length > 0);
    assert.ok(body.results.every((r) => r.strongIds.includes("G25")));
  });

  test("devuelve snippets con <mark>", async () => {
    const { body } = await searchApi("http://localhost/api/bible/search?q=cielo&modules=RV1909");
    assert.ok(body.results.length > 0);
    assert.ok(body.results[0].snippet.includes("<mark>"));
  });
});

describe("API /api/bible/read con comentario", () => {
  test("devuelve la nota del comentario para el versículo activo", async () => {
    await installTestCommentary();
    try {
      const { status, body } = await commentaryApi(
        "http://localhost/api/bible/read?commentary=1&book=Jn&chapter=3",
      );
      assert.equal(status, 200);
      const mine = body.commentary.find((c) => c.moduleId === TEST_COMMENTARY_ID);
      assert.ok(mine, "módulo de comentario de prueba no devuelto");
      const n16 = mine.notes.find((n) => n.verse === 16);
      assert.ok(n16, "falta la nota de Jn 3:16");
      assert.ok(n16.text.includes("cruz"));

      // capítulo sin notas del módulo de prueba → no aparece
      const empty = await commentaryApi(
        "http://localhost/api/bible/read?commentary=1&book=Gen&chapter=50",
      );
      assert.ok(!empty.body.commentary.some((c) => c.moduleId === TEST_COMMENTARY_ID));      // referencia inválida → 400
      const bad = await readGET(
        new Request("http://localhost/api/bible/read?commentary=1&book=Gen&chapter=9999"),
      );
      assert.equal(bad.status, 400);
    } finally {
      const fs = await import("node:fs");
      for (const ext of [".db", ".db-shm", ".db-wal", ".db-journal"]) {
        await fs.promises.rm(path.join(MODULES_DIR, `${TEST_COMMENTARY_ID}${ext}`), { force: true });
      }
    }
  });
});
