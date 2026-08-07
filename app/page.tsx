import { Omnibar } from "../src/components/Omnibar";
import { ThemeApplier } from "../src/components/ThemeApplier";
import { Workspace } from "../src/components/Workspace";

export default function Home() {
  return (
    <div className="flex h-screen flex-col">
      <ThemeApplier />
      <header className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--panel)] px-4 py-2">
        <div className="text-sm font-bold tracking-tight">
          Alethia<span className="text-[var(--accent)]">Bridge</span>
        </div>
        <Omnibar />
      </header>
      <Workspace />
    </div>
  );
}
