"use client";

import { Check, Moon, Sun } from "lucide-react";
import { Button } from "../components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { useExegesisStore } from "../store/useExegesisStore";
import type { ThemeId } from "../types/bible";

const THEMES: { id: ThemeId; label: string }[] = [
  { id: "academic-paper", label: "Claro" },
  { id: "dark-contrast", label: "Oscuro" },
  { id: "sepia", label: "Sepia" },
];

/** Selector de tema (claro / oscuro / sepia) para la cabecera. */
export function ThemeSwitcher() {
  const activeTheme = useExegesisStore((s) => s.activeTheme);
  const setActiveTheme = useExegesisStore((s) => s.setActiveTheme);
  const ThemeIcon = activeTheme === "dark-contrast" ? Moon : Sun;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon-sm" title="Tema" aria-label="Cambiar tema">
            <ThemeIcon className="size-4" />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuLabel>Tema</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {THEMES.map((t) => (
          <DropdownMenuItem key={t.id} onSelect={() => setActiveTheme(t.id)} className="gap-2">
            <Check
              className={`size-3.5 text-primary ${activeTheme === t.id ? "opacity-100" : "opacity-0"}`}
            />
            {t.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
