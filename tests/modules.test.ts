import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { zipSync } from "fflate";
import { GET, POST } from "../app/api/modules/route.ts";
import { DELETE, PATCH } from "../app/api/modules/[id]/route.ts";
import type { ModuleInfo, ModuleListResponse } from "../src/types/module.ts";

const MODULES_DIR = path.join(process.cwd(), "data", "modules");
const TEST_ID = "testcommentary";

function moduleCtx(id: string) {
  return { params: Promise.resolve({ id }) } as Parameters<typeof PATCH>[1];
}

async function listModules(): Promise<ModuleInfo[]> {
  const res = await GET();
  assert.equal(res.status, 200);
  const body = (await res.json()) as ModuleListResponse;
  return body.modules;
}

describe("API /api/modules", () => {
  test("lista módulos instalados con manifest y canon", async () => {
    const modules = await listModules();
    const ids = modules.map((m) => m.id);
    assert.ok(ids.includes("RV1909"), "falta RV1909");
    assert.ok(ids.includes("NA28"), "falta NA28");
    assert.ok(ids.includes("lexicon"), "falta lexicon");

    const rv = modules.find((m) => m.id === "RV1909")!;
    assert.equal(rv.type, "bible");
    assert.equal(rv.language, "es");
    assert.equal(rv.bookCount, 66);
    assert.ok(rv.version, "version requerida");
    assert.equal(rv.status, "installed");
    assert.equal(rv.books?.[0].id, "Gen");

    const lx = modules.find((m) => m.id === "lexicon")!;
    assert.equal(lx.type, "lexicon");
    assert.equal(lx.bookCount, 0);
  });

  test("PATCH activa/desactiva y GET lo refleja", async () => {
    const res = await PATCH(
      new Request("http://localhost/api/modules/RV1909", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled: false }),
      }),
      moduleCtx("RV1909"),
    );
    assert.equal(res.status, 200);
    const body = (await res.json()) as { module: ModuleInfo };
    assert.equal(body.module.status, "disabled");

    const after = await listModules();
    assert.equal(after.find((m) => m.id === "RV1909")!.status, "disabled");

    // re-activar (deja el estado limpio)
    await PATCH(
      new Request("http://localhost/api/modules/RV1909", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled: true }),
      }),
      moduleCtx("RV1909"),
    );
  });

  test("instala y desinstala un paquete .abmod (módulo de comentario)", async () => {
    // Construir el paquete de prueba en memoria
    const tmp = path.join(MODULES_DIR, `.fixture-${TEST_ID}.db`);
    const db = new Database(tmp);
    db.exec(`CREATE TABLE meta (clave TEXT PRIMARY KEY, valor TEXT NOT NULL);`);
    const ins = db.prepare(`INSERT INTO meta (clave, valor) VALUES (?, ?)`);
    const manifest = {
      id: TEST_ID,
      name: "Comentario de prueba",
      type: "commentary",
      language: "es",
      version: "1.0.0",
      publisher: "Tests",
      license: "MIT",
      year: 2026,
      description: "Módulo generado por tests",
      schemaVersion: 1,
    };
    for (const [k, v] of Object.entries(manifest)) {
      ins.run(`manifest_${k}`, String(v));
    }
    db.close();
    const zip = zipSync(
      {
        "manifest.json": new TextEncoder().encode(JSON.stringify(manifest)),
        "module.db": new Uint8Array(await import("node:fs").then((fs) => fs.promises.readFile(tmp))),
      },
      { level: 1 },
    );
    rmSync(tmp);

    // POST instala
    const form = new FormData();
    form.append("file", new File([zip], `${TEST_ID}.abmod`, { type: "application/zip" }));
    const post = await POST(new Request("http://localhost/api/modules", { method: "POST", body: form }));
    const postBody = (await post.json()) as { ok: boolean; moduleId: string };
    assert.equal(post.status, 200);
    assert.equal(postBody.moduleId, TEST_ID);

    const after = await listModules();
    const installed = after.find((m) => m.id === TEST_ID)!;
    assert.ok(installed, "módulo no apareció tras instalar");
    assert.equal(installed.type, "commentary");
    assert.equal(installed.version, "1.0.0");
    assert.equal(installed.status, "installed");

    // DELETE desinstala
    const del = await DELETE(new Request(`http://localhost/api/modules/${TEST_ID}`, { method: "DELETE" }), moduleCtx(TEST_ID));
    assert.equal(del.status, 200);
    const final = await listModules();
    assert.ok(!final.some((m) => m.id === TEST_ID), "módulo sigue listado tras desinstalar");
  });

  test("rechaza paquete sin manifest.json", async () => {
    const badZip = zipSync({ "module.db": new Uint8Array([1, 2, 3]) });
    const form = new FormData();
    form.append("file", new File([badZip], "bad.abmod", { type: "application/zip" }));
    const res = await POST(new Request("http://localhost/api/modules", { method: "POST", body: form }));
    assert.equal(res.status, 422);
  });
});
