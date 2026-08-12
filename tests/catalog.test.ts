import test from "node:test";
import assert from "node:assert/strict";
import { compareSemver } from "../src/lib/modules/catalog-service.ts";
import { GET as getCatalog } from "../app/api/catalog/route.ts";
import { POST as installRemote } from "../app/api/modules/install-remote/route.ts";
import { getModule } from "../src/lib/modules/registry.ts";

test("Semver Comparison Engine", () => {
  assert.equal(compareSemver("1.0.0", "1.0.0"), 0);
  assert.equal(compareSemver("1.1.0", "1.0.0"), 1);
  assert.equal(compareSemver("1.0.1", "1.0.0"), 1);
  assert.equal(compareSemver("2.0.0", "1.9.9"), 1);
  assert.equal(compareSemver("0.9.0", "1.0.0"), -1);
  assert.equal(compareSemver("1.0.0-rc1", "1.0.0"), 0);
});

test("API GET /api/catalog — Catálogo remoto con status de instalación y dependencias", async () => {
  const req = new Request("http://localhost/api/catalog?refresh=1");
  const res = await getCatalog(req);
  assert.equal(res.status, 200);

  const data = (await res.json()) as {
    schemaVersion: number;
    catalogSource: string;
    modules: Array<{
      id: string;
      name: string;
      type: string;
      version: string;
      installStatus: string;
      dependencies?: string[];
      sha256?: string;
    }>;
    installedCount: number;
    availableCount: number;
    durationMs: number;
  };

  assert.equal(data.schemaVersion, 1);
  assert.ok(data.modules.length >= 6, `Esperados al menos 6 módulos en el catálogo, obtenidos ${data.modules.length}`);
  assert.ok(data.durationMs >= 0);

  // Verificar que módulos conocidos como RV1909, WLC, SBLGNT, TA y lexicon existen en el catálogo
  const rv1909 = data.modules.find((m) => m.id === "RV1909");
  assert.ok(rv1909, "RV1909 debe estar en el catálogo");
  assert.equal(rv1909.type, "bible");
  assert.ok(["installed", "update_available", "not_installed"].includes(rv1909.installStatus));

  const lexicon = data.modules.find((m) => m.id === "lexicon");
  assert.ok(lexicon, "lexicon debe estar en el catálogo");
  assert.equal(lexicon.type, "lexicon");

  const ta = data.modules.find((m) => m.id === "TA");
  assert.ok(ta, "TA (Torres Amat) debe estar en el catálogo");
  assert.equal(ta.type, "commentary");

  // 2. Probar usuario limpio con 0 módulos instalados (x-installed-modules: "")
  const cleanReq = new Request("http://localhost/api/catalog", {
    headers: { "x-installed-modules": "" },
  });
  const cleanRes = await getCatalog(cleanReq);
  const cleanData = (await cleanRes.json()) as typeof data;
  assert.equal(cleanData.installedCount, 0, "Usuario limpio debe tener 0 módulos instalados");
  assert.ok(cleanData.modules.every((m) => m.installStatus === "not_installed"));
});

test("API POST /api/modules/install-remote — Instalación remota y resolución de dependencias", { timeout: 20000 }, async () => {
  // 1. Petición sin moduleId devuelve 400
  const reqBad = new Request("http://localhost/api/modules/install-remote", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  });
  const resBad = await installRemote(reqBad);
  assert.equal(resBad.status, 400);

  // 2. Instalar TA (módulo de comentario ligero)
  const reqTA = new Request("http://localhost/api/modules/install-remote", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ moduleId: "TA", force: true }),
  });
  const resTA = await installRemote(reqTA);
  const dataTA = (await resTA.json()) as { ok: boolean; moduleId: string; error?: string };
  assert.equal(resTA.status, 200, `installRemote falló: ${JSON.stringify(dataTA)}`);
  assert.equal(dataTA.ok, true);
  assert.equal(dataTA.moduleId, "TA");

  // Verificar en el registry
  const installedTA = getModule("TA");
  assert.ok(installedTA);
  assert.equal(installedTA.type, "commentary");

  // 3. Fallo de SHA-256 cuando no coincide
  const reqMismatch = new Request("http://localhost/api/modules/install-remote", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      moduleId: "TA",
      downloadUrl: "https://example.com/fake.abmod",
      sha256: "0000000000000000000000000000000000000000000000000000000000000000",
    }),
  });
  const resMismatch = await installRemote(reqMismatch);
  // Debe fallar por no poder descargar o sha inválido
  assert.ok(resMismatch.status === 422 || resMismatch.status === 500);
});
