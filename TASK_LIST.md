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
- [x] Test de integración SLA: `/api/bible/read` < 10ms y `/api/bible/search` < 30ms (7/7 tests pasan)
- [x] Resumen final de arquitectura en `README.md`
