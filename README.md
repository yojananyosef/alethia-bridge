# Alethia Bridge

Software de análisis exegético y estudio bíblico (estilo Logos/Accordance/STEPBible): lector interlineal griego/español, búsqueda full-text y análisis léxico-morfológico.

**Stack:** Next.js 16 (App Router, RSC) · TypeScript strict · Zustand · Tailwind v4 · SQLite nativo (`better-sqlite3`) · IndexedDB (Dexie) · TipTap

## Comandos

```bash
bun install          # dependencias (better-sqlite3 usa binario prebuilt; ver ignoreScripts)
bun run seed         # genera data/modules/*.db (Juan 3 RV1909 + NA28 + léxico Strong + índice FTS5)
bun run import       # ETL real: USFX/OSIS XML → módulo instalable (node scripts/import-osis.ts)
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
  api/
    bible/
      read/route.ts     # GET /api/bible/read  (capítulo interlineal + ?lexicon= + ?morph=)
      search/route.ts   # GET /api/bible/search (FTS5, insensible a acentos)
    modules/
      route.ts          # GET /api/modules (lista) · POST (instalar .abmod)
      [id]/route.ts     # PATCH (enable/disable) · DELETE (desinstalar)
scripts/
  seed-test-db.ts       # genera los SQLite de prueba (Juan 3 completo + manifests + canon)
  import-osis.ts        # ETL real: USFX/OSIS XML → SQLite (SAX, milestones, Strong, manifest+canon)
  package-module.ts     # empaqueta un módulo instalado a .abmod (bun run package <id>)
src/
  lib/canon.ts          # canon 66 libros compartido (id interno + código USFX + nombre OSIS)
  lib/db/sqlite.ts      # conexiones WAL, esquema, normalizeText, meta/libros
  lib/db/dexie-user-db.ts  # notas y resaltados locales (IndexedDB)
  lib/bible/service.ts  # readChapter, searchBible, getLexiconEntry, getMorphology
  lib/modules/
    registry.ts         # discovery de módulos: manifest, canon, estado enable/disable
    package.ts          # formato .abmod: empaquetar/instalar (fflate)
  types/bible.ts        # tipos estrictos del dominio bíblico
  types/module.ts       # ModuleManifest / ModuleInfo / canon
  store/useExegesisStore.ts  # estado global Zustand
  components/
    Workspace.tsx           # 3 paneles redimensionables (react-resizable-panels v4)
    PanelLeftNavigation.tsx # canon dinámico desde el módulo primario + gestor de módulos
    PanelCenterReader.tsx   # lector interlineal multipanel
    PanelRightAnalysis.tsx  # léxico/morfología + notas TipTap
    interlinear/WordTokenView.tsx  # token memoizado, hover sin re-renders
    Omnibar.tsx             # cmd+K: navegación, módulos, temas
```

### Sistema de módulos (.abmod)

Cada módulo es una base SQLite con su **manifest** (tabla `meta`) y, para biblias, el **canon** (tabla `libros`). El registry escanea `data/modules/*.db` en cada petición, resuelve idioma/estado y expone todo vía `/api/modules`.

**Formato `.abmod`**: zip con `manifest.json` + `module.db` (copia limpia sin WAL).

```bash
bun run package RV1909        # → dist-modules/RV1909-1.0.0.abmod
```

Instalación: botón "+" en el panel izquierdo (sube el `.abmod`) o `POST /api/modules`. El instalador valida manifest (id, schemaVersion, duplicados) y dependencias; escribe con temp+rename (atómico). Desinstalar: `DELETE /api/modules/:id`.

Tipos de módulo: `bible`, `lexicon`, `commentary`, `crossref`, `devotion`. Los módulos biblia definen el canon (66 libros OSIS) que alimenta la navegación y el Omnibar.

### ETL de módulos reales (import-osis)

El pipeline real importa biblias en **USFX** (XML de USFM), **OSIS con milestones** o el **simple-xml** de `simoncozens/open-source-bible-data` hacia un `.abmod` instalable:

```bash
bun run import data/osis/spa-rv1909.usfx.xml RV1909 \
  --name "Reina-Valera 1909" --lang es --license "Public Domain"
```

- Parser SAX streaming (`sax`): milestones de libro/capítulo/versículo en ambos formatos XML, CDATA, entidades Latin-1; simple-xml (`<book num>`/`<chapter num>`/`<verse num>`, `<w strongs pos morph lemma>`).
- Tagging Strong: `<w s="H7225">` (USFX), `<w lemma="strong:G3056" morph>` / `<seg subType="x-strong:…">` (OSIS), `strongs="01080"` (simple-xml → G1080), lemma hebreo morphhb (`b/7225` → H7225); notas/títulos excluidos.
- El lema de la fuente se prefiere sobre lexicon.db (p. ej. lemas griegos del SBLGNT); morfología Robinson cruda (morphgnt / morphhb).
- `--drop-word-slash`: elimina los `/` de marcación de prefijos del texto morfológico hebreo (morphhb).
- El módulo se empaqueta/instala como cualquier otro (`bun run package <id>`).

Fuentes libres probadas: RV1909 completo con Strongs (USFX, dominio público, `github.com/seven1m/open-bibles`); SBLGNT completo con Strong+morfología+lemas (simple-xml, texto SBLGNT EULA, análisis morphgnt CC-BY-SA 3.0, `github.com/simoncozens/open-source-bible-data`); WLC 4.20 hebreo completo con Strong+morfología Robinson (OSIS, dominio público, `github.com/openscriptures/morphhb`); eBible.org publica OSIS con milestones para muchas traducciones libres.

### Flujo de datos

- **Servidor**: `better-sqlite3` con `PRAGMA journal_mode=WAL` (lecturas < 10ms). Los módulos RV1909 y SBLGNT se alinean por `alineacion_id` en `palabras_interlineal`.
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

Ver `TASK_LIST.md` (Fases 1–7 completas).
