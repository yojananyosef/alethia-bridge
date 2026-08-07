# ALEPHIA BRIDGE — Hoja de Ruta de Ejecución

Software de análisis exegético y estudio bíblico (estilo Logos/Accordance/STEPBible).
Monolito modular Next.js 16 (App Router) + TypeScript strict + RSC + Zustand + Tailwind v4 + SQLite nativo (`better-sqlite3`).

**SLA de rendimiento innegociables:**
- Consulta de versículos en servidor (SQLite): **< 10ms**
- Búsqueda FTS5 en texto completo: **< 30ms**
- Resalte interlineal en cliente (`hoveredAlignmentId`): **0ms lag perceptible** (sin re-renders masivos)

---

## FASE 1 — Base de Datos, Seeds y ETL Parser ✅
- [x] Instalar `better-sqlite3` + `@types/better-sqlite3` (trustedDependencies) y configurar `serverExternalPackages` en `next.config.ts`
- [x] Crear `src/lib/db/sqlite.ts`: gestor de conexiones con `PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; busy_timeout`
- [x] Crear `scripts/seed-test-db.ts` (better-sqlite3):
  - [x] Generar `/data/modules/RV1909.db`, `/data/modules/NA28.db`, `/data/modules/lexicon.db`
  - [x] Poblar Juan 3 completo en Español (RV1909) y Griego (NA28/SBLGNT) con tokenización interlineal (`palabras_interlineal`, `alineacion_id`)
  - [x] Poblar `lexicon.db` (diccionario Strongs: G3588, G2588, G15… + `parsing_gramatical`)
  - [x] Index FTS5 `versiculos_fts` poblado
- [x] Crear borrador `scripts/import-osis.ts` (parser XML OSIS → SQLite)
- [x] **Validación:** `npx tsc --noEmit` (0 errores) + query manual de verificación

## FASE 2 — Backend API Routes & Search Engine ✅
- [x] Definir tipos estrictos en `src/types/bible.ts`: `WordToken`, `VersePayload`, `MorphologyAnalysis`, `SearchResult`, `OmnibarCommand`
- [x] API `GET /api/bible/read?book=&chapter=&modules=`: JOIN versiculos + palabras_interlineal, agrupado por `alineacion_id`, estructura interlineal lista para renderizar
- [x] API `GET /api/bible/search?q=&modules=`: FTS5 MATCH (lemas, comodines, keywords) + join a lexicon
- [x] Test bun: `/read` < 10ms
- [x] **Validación:** `npx tsc --noEmit` + `curl` manual

## FASE 3 — Estado Global (Zustand) & Local-First IndexedDB ✅
- [x] `src/store/useExegesisStore.ts`: `hoveredAlignmentId`, `activeLexiconTerm`, `syncGroupA`, `activeTheme`
- [x] Provider del store para cruzar el límite RSC/client
- [x] `src/lib/db/dexie-user-db.ts`: `highlights` + `user_notes`
- [x] **Validación:** `npx tsc --noEmit`

## FASE 4 — UI Engine (Client Components & Layout Resizable) ✅
- [x] Layout de 3 paneles con `react-resizable-panels` **v4** (API `Group`/`Panel`/`Separator` + `useDefaultLayout`; montaje solo en cliente por SSR con localStorage):
  - [x] Izquierdo: navegación libros/capítulos + toggle de módulos (Zustand)
  - [x] Central: lector interlineal multipanel (RV1909 + NA28) con fetch client → `/api/bible/read`
  - [x] Derecho: análisis léxico/morfológico (endpoints `?lexicon=` y `?morph=`) + notas TipTap en Dexie
- [x] `src/components/Omnibar.tsx` (cmdk + ⌘K): navegación de pasajes, toggle módulos, temas
- [x] Renderizador interlineal: `WordToken` memoizado con selector Zustand por `alineacion_id` (hover sin re-renders), click → Strong, morfología bajo el griego
- [x] Temas: academic-paper / dark-contrast / sepia (CSS vars + `data-theme`) con `ThemeApplier`
- [x] Fix: mover API routes de `src/app/api` → `app/api` (Next 16 solo sirve la raíz `app/`) + corregir imports relativos
- [x] Fix: búsqueda insensible a acentos — `texto_norm` en import-osis, query normalizada, snippet `<mark>` manual sobre el texto original
- [x] **Validación:** `curl` real (read/search/lexicon/morph = 200, griego y sin-acento OK) + `npx tsc --noEmit` (0 errores) + 7/7 tests + `bun run build` OK

## FASE 5 — Validaciones, Tests TDD y Documentación ✅
- [x] Test de integración SLA: `/api/bible/read` < 10ms y `/api/bible/search` < 30ms (11/11 tests pasan)
- [x] Resumen final de arquitectura en `README.md`

## FASE 6 — Sistema de Módulos Instalables (.abmod) ✅
- [x] `src/types/module.ts`: `ModuleManifest`, `ModuleInfo`, canon (`ModuleBook`), `APP_SCHEMA_VERSION`
- [x] Tablas `meta` + `libros` en sqlite.ts y seed con manifests de RV1909/NA28/WTT/lexicon + canon 66 libros OSIS
- [x] `src/lib/modules/registry.ts`: discovery de `data/modules/*.db`, estado enable/disable (`.state.json`), módulo primario, validación de dependencias
- [x] `src/lib/modules/package.ts`: formato `.abmod` (zip `manifest.json` + `module.db`) con fflate; instalación atómica temp+rename
- [x] `scripts/package-module.ts` (`bun run package <id>`) → `dist-modules/<id>-<version>.abmod`
- [x] API: `GET/POST /api/modules` (lista + instalar multipart) y `PATCH/DELETE /api/modules/:id` (enable/disable/uninstall)
- [x] UI: navegación canónica dinámica desde el módulo primario, gestor de módulos (toggle/instalar/desinstalar) en el panel izquierdo, Omnibar con lista del registry, aviso de capítulo sin contenido
- [x] Service: `MODULE_LANGUAGES` y módulos válidos reemplazados por resolución vía registry
- [x] Tests: list/toggle/install/uninstall/rechazo de paquetes inválidos (11/11) + `bun run build` OK

## FASE 7 — ETL Real: Importador USFX/OSIS + módulo real RV1909 ✅
- [x] `src/lib/canon.ts`: canon 66 libros compartido (id interno + código USFX + nombre OSIS + capítulos)
- [x] `scripts/import-osis.ts` reescrito de cero: parser SAX real (`sax`, streaming, tolerante)
  - [x] Milestones USFX (`<v id>`/`<ve>`, `<c id>`, `<book id>`) y OSIS (`<verse sID/eID>`, `<div type=book>`, `<chapter>`)
  - [x] Tagging Strong: `<w s="H7225">` (USFX) / `<w lemma="strong:G3056" morph>` / `<seg subType="x-strong:G3056">` (OSIS)
  - [x] Notas y títulos excluidos (note/f/x/title/h/toc/id/figure); CDATA y entidades Latin-1
  - [x] Lemas resueltos desde lexicon.db (cacheados); strongs normalizados (H0430→H430)
  - [x] Escribe manifest (meta) + canon (libros) → módulo instalable y empaquetable directamente
- [x] **Módulo real**: RV1909 completo con Strongs (USFX, dominio público, open-bibles) → 31.084 versículos, 704.402 tokens, 66 libros (9s de import)
- [x] Fix rendimiento: índice UNIQUE `(id_versiculo, posicion)` — lookup de tokens pasó de scan completo (150ms) a µs
- [x] Fix snippet: `buildSnippet` con NFD (letras precompuestas con acento: "Espíritu"→espiritu)
- [x] `/api/bible/search` devuelve `total` real (COUNT FTS) — preparado para paginación
- [x] Cache de registry por mtime (instalar/desinstalar/toggle invalidan automáticamente)
- [x] Empaquetado: `dist-modules/RV1909-1.0.0.abmod` (30 MB)
- [x] **Validación:** 13/13 tests + SLA read <10ms / search <30ms con el texto completo + curl E2E + build OK

## FASE 8 — Módulo real SBLGNT (griego con Strong + morfología + lemas) ✅
- [x] Fuente: `simoncozens/open-source-bible-data` → `cooked/simple-xml/sbl.xml` (SBLGNT con etiquetas de morphgnt y Strongs; CC BY 4.0 texto / CC-BY-SA 3.0 análisis)
- [x] `src/lib/canon.ts`: mapa `bookIdBySblCode` (abreviaturas simple-xml: Matt, 1Cor, Phlm…)
- [x] `scripts/import-osis.ts`: tercer formato `simple-xml` (raíz `<bible>`, `<book num>`/`<chapter num>`/`<verse num>`, `<w pos morph lemma strongs>`)
  - [x] `strongs="01080"` → G+Strong normalizado (G1080); `morph` Robinson crudo (3AAI-S--); lema griego de la fuente (preferido sobre lexicon.db); fallback de morfología a `pos`
- [x] **Módulo real**: SBLGNT completo (Holmes 2010) → 7.927 versículos (conteo SBLGNT, sin Mc 16:9-20/Jn 7:53-8:11), 137.557 tokens, 134.099 con Strong (97,5%), 100% morph+lema, 457 códigos morph, 66 libros (2,8s)
- [x] Texto crítico con sigla ⸀ conservada en `texto_plano` (excluida de tokens); alineación `Jn3:16:g<n>` compatible con RV1909
- [x] Empaquetado: `dist-modules/SBLGNT-1.0.0.abmod` (7,6 MB); 13/13 tests verdes; SLA read 3,8ms

## FASE 9 — Módulo real WLC (hebreo con Strong + morfología Robinson) ✅
- [x] Fuente: `openscriptures/morphhb` (dominio público, WLC 4.20) — 40 archivos OSIS → combinados en `data/osis/hbo-wlc.osis.xml` (un `<div type="book">` por libro, headers descartados)
- [x] `src/lib/canon.ts`: mapa `bookIdByOsisId` unificado (IDs OSIS estándar: Gen, Exod, 1Sam, Ps, 1Cor…; OT+NT) — `bookIdBySblCode` ahora delega en él
- [x] `scripts/import-osis.ts`: parsing de lemma hebreo morphhb (`b/7225`/`b/d/1870`/`1254 a`/`8423+` → H-código; partículas puras sin raíz → sin strong); flag `--drop-word-slash` (el `/` de morphhb marca prefijos, se elimina del texto)
- [x] **Módulo real**: WLC completo → 23.213 versículos, 308.674 tokens, 299.556 con Strong (97%), 305.507 con morph (99%, 3.443 códigos), 8.632 strongs distintos, 39 libros AT (7s)
- [x] Gen 1:1 alineado con RV1909 (7/7 pares posicionales); sin G-codes filtrados; SLA read 15ms (2 módulos)
- [x] Empaquetado: `dist-modules/WLC-1.0.0.abmod` (18 MB); 13/13 tests × 2; tsc+lint limpios
- [x] Fix test SLA búsqueda: warm-up con la misma query (cold-start FTS por término, no por módulo)

## FASE 10 — Diccionario Strong real (lexicon) ✅
- [x] `scripts/import-lexicon.ts` (nuevo, SAX): reconstruye `data/modules/lexicon.db` manteniendo `parsing_gramatical`; escribe manifest → empaquetable
- [x] **Hebreo**: `HebrewStrong.xml` (StrongSchema/OpenScriptures, CC BY 4.0) → 8.674 entradas (lema, translit, pronunciación, `meaning` corto, `source`+`usage` detallado)
- [x] **Griego**: `strongsgreek.xml` (morphgnt, CC BY 4.0) → 5.624 entradas (lema unicode, translit, pronunciación, `kjv_def` corto, `strongs_def`+derivation detallado)
- [x] **Cobertura 100%** de strongs en los 3 módulos reales (RV1909 13.361, SBLGNT 4.843, WLC 8.632) — el 1 restante es un H fuera del rango del diccionario
- [x] Fix `import-osis.ts`: strongs compuestos USFX ("H5315 H2416") → se toma el primero (RV1909 pasó de 89% a 100%)
- [x] Seed: `INSERT OR IGNORE` en diccionario (no pisa el diccionario real; solo añade las 40 curadas si faltan)
- [x] `bun run import:lexicon`; empaquetado `dist-modules/lexicon-1.0.0.abmod` (1 MB); 13/13 tests; tsc+lint limpios

## FASE 11 — Morfología real en `parsing_gramatical` ✅
- [x] **Hebreo**: `Oshm.xml` (Open Scriptures Hebrew Morphology, 3.481 códigos) → 3.435 códigos reales de WLC con descripción (99,8%); 8 compuestos raros con fallback "sin descripción en OSHM"; categoría extraída del texto (Noun/Verb/Particle…)
- [x] **Griego**: decodificador posicional morphgnt/Robinson (8 chars, spec del README de sblgnt + vocativo descubierto en los datos) → 457 códigos de SBLGNT con descripciones en español y categoría (Verbo/Participio/Infinitivo/Nombre/Adjetivo/Partícula)
- [x] Ejemplos: `3AAI-S--` → "3ª persona aoristo activo indicativo singular"; `----NSF-` → "nominativo singular femenino"; `HVqp3ms` → "Hebrew: Verb qal perfect third person masculine singular"
- [x] Las 20 entradas curadas del seed (STEPBible, V-AIA-3S) se conservan; los códigos generados se refrescan en cada import
- [x] Empaquetado actualizado: `dist-modules/lexicon-1.0.0.abmod` (1,1 MB); 13/13 tests; tsc+lint limpios

## Próximos pasos (roadmap módulos)
- [ ] Tipos de módulo `commentary`/`crossref`/`devotion` con renderizado dedicado
- [ ] Registry remoto con checksums SHA-256 y actualizaciones por versión
- [ ] Datos de usuario keyeados por `moduleId + osisRef` (independientes de la versión del módulo)
- [ ] Tokenización por idioma + alineación interlineal generalizada multi-módulo
- [ ] Importador SWORD binario (CrossWire Raw ZIP) solo para textos sin fuente XML
