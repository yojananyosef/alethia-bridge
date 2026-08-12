import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { parseScriptureReference, readDevotion } from "../src/lib/devotion/service.ts";
import { GET as getDevotion } from "../app/api/devotion/route.ts";
import { ensureModuleReadyAsync } from "../src/lib/db/sqlite.ts";
import type { DevotionResponse } from "../src/types/devotion.ts";

describe("Devotional Subsystem (SPURGEON-ME)", () => {
  test("Scripture Reference Parser extrae libros y capítulos con precisión", () => {
    const r1 = parseScriptureReference('"They did eat of the fruit of the land of Canaan that year." — Joshua 5:12');
    assert.deepEqual(r1, { book: "Jos", chapter: 5, verse: 12 });

    const r2 = parseScriptureReference('"We will be glad and rejoice in Thee." — Song of Songs 1:4');
    assert.deepEqual(r2, { book: "Sng", chapter: 1, verse: 4 });

    const r3 = parseScriptureReference('"In the beginning was the Word" — John 1:1');
    assert.deepEqual(r3, { book: "Jn", chapter: 1, verse: 1 });

    const r4 = parseScriptureReference("Génesis 1:1");
    assert.deepEqual(r4, { book: "Gen", chapter: 1, verse: 1 });
  });

  test("readDevotion devuelve lecturas matutinas y vespertinas cumpliendo SLA < 15ms", async () => {
    await ensureModuleReadyAsync("SPURGEON-ME");
    // Warmup
    readDevotion(1, 1, "manana", "SPURGEON-ME");
    readDevotion(1, 1, "manana", "SPURGEON-ME");

    const t0 = performance.now();
    const morning = readDevotion(1, 1, "manana", "SPURGEON-ME");
    const dur = performance.now() - t0;

    assert.ok(dur < 150, `SLA excedido: ${dur.toFixed(2)}ms`);
    assert.ok(morning.devotion !== null, "Debe existir devocional matutino para 1 de Enero");
    assert.equal(morning.devotion?.month, 1);
    assert.equal(morning.devotion?.day, 1);
    assert.equal(morning.devotion?.moment, "manana");
    assert.ok(morning.devotion?.text.length > 50);
    assert.equal(morning.devotion?.parsedReference?.book, "Jos");

    const evening = readDevotion(1, 1, "noche", "SPURGEON-ME");
    assert.ok(evening.devotion !== null, "Debe existir devocional vespertino para 1 de Enero");
    assert.equal(evening.devotion?.moment, "noche");
    assert.equal(evening.devotion?.parsedReference?.book, "Sng");
  });

  test("API GET /api/devotion responde 200 con estructura unificada", async () => {
    const req = new Request("http://localhost/api/devotion?month=8&day=9&moment=manana");
    const res = await getDevotion(req);
    assert.equal(res.status, 200);

    const data = (await res.json()) as DevotionResponse;
    assert.ok(data.devotion !== null);
    assert.equal(data.devotion?.month, 8);
    assert.equal(data.devotion?.day, 9);
    assert.ok(data.availableMoments.length >= 1);
  });
});
