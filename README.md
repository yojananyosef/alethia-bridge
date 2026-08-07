# Alethia Bridge

Software de análisis exegético y estudio bíblico (estilo Logos/Accordance/STEPBible): lector interlineal griego/español, búsqueda full-text y análisis léxico-morfológico.

**Stack:** Next.js 16 (App Router, RSC) · TypeScript strict · Zustand · Tailwind v4 · SQLite nativo (`better-sqlite3`) · IndexedDB (Dexie) · TipTap

## Comandos

```bash
bun install          # dependencias (better-sqlite3 usa binario prebuilt; ver ignoreScripts)
bun run seed         # genera data/modules/*.db (Juan 3 RV1909 + NA28 + léxico Strong + índice FTS5)
bun run dev          # servidor de desarrollo en http://localhost:3000
bun run test         # tests de integración (SLA de la API)
bun run build        # build de producción
npx tsc --noEmit     # typecheck estricto
```

## Arquitectura

```
app/
  layout.tsx            # layout raíz + ExegesisProvider (metadatos, fuentes)
  page.tsx              # header + Omnibar + Workspace
  globals.css           # temas (CSS vars + data-theme)
  api/bible/
    read/route.ts       # GET /api/bible/read  (capítulo interlineal + ?lexicon= + ?morph=)
    search/route.ts     # GET /api/bible/search (FTS5, insensible a acentos)
scripts/
  seed-test-db.ts       # genera los SQLite de prueba (Juan 3 completo)
  import-osis.ts        # ETL borrador: OSIS XML → SQLite
src/
  lib/db/sqlite.ts      # conexiones WAL, esquema, normalizeText
  lib/db/dexie-user-db.ts  # notas y resaltados locales (IndexedDB)
  lib/bible/service.ts  # readChapter, searchBible, getLexiconEntry, getMorphology
  types/bible.ts        # tipos estrictos del dominio
  store/useExegesisStore.ts  # estado global Zustand
  components/
    Workspace.tsx           # 3 paneles redimensionables (react-resizable-panels v4)
    PanelLeftNavigation.tsx # libros/capítulos + toggle de módulos
    PanelCenterReader.tsx   # lector interlineal multipanel
    PanelRightAnalysis.tsx  # léxico/morfología + notas TipTap
    interlinear/WordTokenView.tsx  # token memoizado, hover sin re-renders
    Omnibar.tsx             # cmd+K: navegación, módulos, temas
```

### Flujo de datos

- **Servidor**: `better-sqlite3` con `PRAGMA journal_mode=WAL` (lecturas < 10ms). Los módulos RV1909 y NA28 se alinean por `alineacion_id` en `palabras_interlineal`.
- **API**: Route Handlers que sirven payloads listos para renderizar (`ReadResponse`, `SearchResponse`).
- **Cliente**: la store Zustand sincroniza paneles (pasaje activo, hover interlineal, término léxico, tema). Los tokens griegos se suscriben por selector a su `alineacion_id`, de modo que el hover resalta en 0 re-renders de página.
- **Local-first**: notas (TipTap → HTML) y resaltados se guardan en IndexedDB vía Dexie.

### Búsqueda

- FTS5 sobre `texto_norm` (sin acentos/case), query normalizada en el servidor → `espiritu` encuentra «Espíritu».
- Snippets con `<mark>` construidos sobre el texto original.
- Busca por Strong (`G25`) y por prefijo griego (`πιστευ*`).

### SLAs verificados por test

| Operación | SLA |
|---|---|
| Lectura de capítulo (SQLite) | < 10ms |
| Búsqueda FTS5 | < 30ms |
| Resalte interlineal (hover) | 0 re-renders de página |

## Roadmap

Ver `TASK_LIST.md` (Fases 1–4 completas; Fase 5 en curso).
