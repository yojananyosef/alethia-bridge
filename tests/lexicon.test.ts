import test from "node:test";
import assert from "node:assert/strict";
import { parseLexiconRef, parseScriptureReference, normalizeBookId } from "../src/lib/bible/reference-parser.ts";

test("Lexicon Reference Parser — Abreviaturas académicas de Abbott-Smith y STEPBible", () => {
  // 1. Citas estándar
  const ref1 = parseLexiconRef("Mrk.2.15");
  assert.equal(ref1.length, 1);
  assert.equal(ref1[0].book, "Mrk");
  assert.equal(ref1[0].chapter, 2);
  assert.equal(ref1[0].verse, 15);

  // 2. Citas compuestas con punto y coma (hereda libro)
  const ref2 = parseLexiconRef("Mat.2.18; 16.1");
  assert.equal(ref2.length, 2);
  assert.deepEqual(ref2[0], { book: "Mat", chapter: 2, verse: 18 });
  assert.deepEqual(ref2[1], { book: "Mat", chapter: 16, verse: 1 });

  // 3. Epístolas con prefijo en números romanos (IIIJhn.10, ICo.5.2)
  const ref3 = parseLexiconRef("IIIJhn.10");
  assert.equal(ref3.length, 1);
  assert.deepEqual(ref3[0], { book: "3Jn", chapter: 1, verse: 10 });

  const ref4 = parseLexiconRef("1Co.5.2");
  assert.equal(ref4.length, 1);
  assert.deepEqual(ref4[0], { book: "1Co", chapter: 5, verse: 2 });

  // 4. Múltiples referencias separadas por punto y coma con capítulos distintos
  const ref5 = parseLexiconRef("Rom.7.12; 9.4");
  assert.equal(ref5.length, 2);
  assert.deepEqual(ref5[0], { book: "Rom", chapter: 7, verse: 12 });
  assert.deepEqual(ref5[1], { book: "Rom", chapter: 9, verse: 4 });

  // 5. Cita con formato de nombre extendido (Luke.14.22)
  const ref6 = parseLexiconRef("Luke.14.22");
  assert.equal(ref6.length, 1);
  assert.deepEqual(ref6[0], { book: "Luk", chapter: 14, verse: 22 });

  // 6. Citas del Antiguo Testamento
  const ref7 = parseLexiconRef("Heb.1.1");
  assert.equal(ref7.length, 1);
  assert.deepEqual(ref7[0], { book: "Heb", chapter: 1, verse: 1 });

  const ref8 = parseLexiconRef("Est.19.13");
  assert.equal(ref8.length, 1);
  assert.deepEqual(ref8[0], { book: "Est", chapter: 19, verse: 13 });
});

test("Scripture Reference Parser — Normalización universal", () => {
  assert.equal(normalizeBookId("Mat"), "Mat");
  assert.equal(normalizeBookId("Matthew"), "Mat");
  assert.equal(normalizeBookId("Mateo"), "Mat");
  assert.equal(normalizeBookId("1Juan"), "1Jn");
  assert.equal(normalizeBookId("IIIJhn"), "3Jn");
  assert.equal(normalizeBookId("Revelation"), "Rev");
  assert.equal(normalizeBookId("Apocalipsis"), "Rev");

  const parsed = parseScriptureReference("1 Corintios 13:4");
  assert.deepEqual(parsed, { book: "1Co", chapter: 13, verse: 4 });

  const parsed2 = parseScriptureReference("Jn 3:16");
  assert.deepEqual(parsed2, { book: "Jn", chapter: 3, verse: 16 });
});
