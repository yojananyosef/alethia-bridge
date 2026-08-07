"use client";

import { Check, Moon, Sun } from "lucide-react";
import { Button } from "../components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
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
        <DropdownMenuGroup>
          <DropdownMenuLabel>Tema</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {THEMES.map((t) => (
            <DropdownMenuItem
              key={t.id}
              onClick={() => setActiveTheme(t.id)}
              onSelect={() => setActiveTheme(t.id)}
              className="flex cursor-pointer items-center gap-2"
            >
              <Check
                className={`size-3.5 text-primary ${activeTheme === t.id ? "opacity-100" : "opacity-0"}`}
              />
              <span className="flex-1 font-medium">{t.label}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
