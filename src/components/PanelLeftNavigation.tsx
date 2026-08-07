"use client";

import { BookOpenText } from "lucide-react";
import { useExegesisStore } from "../store/useExegesisStore";

const BOOKS = [
  { id: "Gen", chapters: 50 },
  { id: "Jn", chapters: 21 },
  { id: "Apo", chapters: 22 },
];

function BookItem({ book }: { book: string }) {
  const { syncGroupA, setSyncGroupA } = useExegesisStore();
  const isActive = syncGroupA.book === book;
  const meta = BOOKS.find((b) => b.id === book)!;
  return (
    <div className="px-1">
      <button
        onClick={() => setSyncGroupA({ book, chapter: 1, verse: 1 })}
        className={`w-full rounded px-2 py-1 text-left text-sm ${
          isActive
            ? "bg-[var(--accent-soft)] font-semibold text-[var(--accent)]"
            : "text-[var(--ink)] hover:bg-[var(--accent-soft)]"
        }`}
      >
        <BookOpenText className="mr-1 inline h-3.5 w-3.5" />
        {book}
      </button>
      {isActive && (
        <div className="mt-1 grid grid-cols-7 gap-1 pl-3">
          {Array.from({ length: meta.chapters }, (_, i) => i + 1).map((c) => (
            <button
              key={c}
              onClick={() => setSyncGroupA({ book, chapter: c, verse: 1 })}
              className={`rounded px-1 py-0.5 text-xs ${
                syncGroupA.chapter === c
                  ? "bg-[var(--accent)] text-white"
                  : "text-[var(--muted)] hover:bg-[var(--accent-soft)]"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function PanelLeftNavigation() {
  const activeModules = useExegesisStore((s) => s.activeModules);
  const toggleModule = useExegesisStore((s) => s.toggleModule);
  return (
    <aside className="flex h-full flex-col border-r border-[var(--border)] bg-[var(--panel)]">
      <div className="border-b border-[var(--border)] px-3 py-2 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
        Biblias
      </div>
      <nav className="flex-1 overflow-y-auto p-2">
        {BOOKS.map((b) => (
          <BookItem key={b.id} book={b.id} />
        ))}
      </nav>
      <div className="border-t border-[var(--border)] px-3 py-2">
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
          Módulos
        </div>
        {["RV1909", "NA28", "WTT"].map((m) => (
          <label key={m} className="flex cursor-pointer items-center gap-1.5 py-0.5 text-xs">
            <input
              type="checkbox"
              checked={activeModules.includes(m)}
              onChange={() => toggleModule(m)}
              className="accent-[var(--accent)]"
            />
            {m}
          </label>
        ))}
      </div>
    </aside>
  );
}
